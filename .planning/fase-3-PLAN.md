# Fase 3 — Cola con Retry, Handover y Notificaciones
# PLAN completo para /gsd:execute-phase 3 → Antigravity /execute

## Contexto de la fase

El bot responde. Ahora necesitamos dos cosas:
1. Que NUNCA se pierda un mensaje aunque falle OpenAI o la API de WhatsApp
2. Que cuando el bot no pueda responder, el dueño reciba alerta en Telegram
   y pueda tomar control desde ahí

Al final: el dueño duerme tranquilo. El bot atiende de madrugada.
Cuando alguien pregunta algo raro, el dueño recibe alerta en Telegram,
responde desde ahí, y el mensaje llega al cliente de WhatsApp.

## Señal de éxito

```
1. Cliente envía mensaje con intención DESCONOCIDO
2. Bot responde: "Te conecto con un ejecutivo en breve"
3. Dueño recibe en Telegram: "💬 Nuevo mensaje de +56912345678: [mensaje]"
4. Dueño responde en Telegram
5. Respuesta llega al WhatsApp del cliente
6. Dueño escribe /bot → bot retoma la conversación
```

---

## Tareas — Wave 1 (paralelas, independientes)

<task type="auto" id="3-1">
  <n>Configuración robusta de BullMQ con dead letter queue</n>
  <files>
    src/queue/index.js (refactor completo)
    src/queue/queues.js
    src/queue/jobs.js
  </files>
  <action>
    En src/queue/queues.js:
    Definir y exportar todas las colas del sistema usando ioredis connection:

    messageQueue: cola principal de procesamiento de mensajes
    - defaultJobOptions:
      attempts: 3
      backoff: { type: 'exponential', delay: 1000 }
      removeOnComplete: { count: 1000 }
      removeOnFail: false (conservar fallidos para análisis)

    notificationQueue: cola para notificaciones Telegram al dueño
    - defaultJobOptions:
      attempts: 5
      backoff: { type: 'fixed', delay: 2000 }
      removeOnComplete: { count: 500 }

    handoverQueue: cola para gestión de handover humano
    - defaultJobOptions:
      attempts: 3
      backoff: { type: 'exponential', delay: 500 }

    deadLetterQueue: cola separada para mensajes que fallaron 3 veces
    - Sin retry — solo almacenamiento para análisis
    - Agregar listener onFailed en messageQueue:
      si job.attemptsMade >= job.opts.attempts → mover a deadLetterQueue
      loggear con logger.error el mensaje perdido

    En src/queue/jobs.js:
    Constantes para nombres de jobs:
    PROCESS_MESSAGE = 'process-message'
    NOTIFY_HANDOVER = 'notify-handover'
    NOTIFY_TIMEOUT  = 'notify-timeout'
    HANDOVER_TIMEOUT_CHECK = 'handover-timeout-check'
    SEND_MESSAGE = 'send-message'

    En src/queue/index.js:
    - Importar y re-exportar todas las colas
    - Función addMessageJob(data): encolar con prioridad según hora
      * Horario noche (22:00-08:00): priority 1 (alta — cliente esperando)
      * Horario día: priority 5 (normal)
    - Función addNotificationJob(data): encolar notificación
    - Función addHandoverJob(data): encolar handover
    - Función getQueueStats(): retornar counts de todas las colas
      { waiting, active, completed, failed, delayed }
  </action>
  <verify>
    Arrancar worker, encolar job que falla 3 veces intencionalmente,
    verificar que termina en deadLetterQueue y no se pierde
  </verify>
  <done>
    3 colas configuradas con retry exponencial, dead letter queue funcional,
    jobs con prioridad por horario
  </done>
</task>

<task type="auto" id="3-2">
  <n>Nanobot Telegram skill — notificaciones al dueño</n>
  <files>
    src/notifications/telegram.js
    src/notifications/index.js
  </files>
  <action>
    En src/notifications/telegram.js:
    El dueño usa Nanobot — un bot de Telegram personal corriendo en su máquina.
    Nanobot tiene su propio token de bot de Telegram.
    Nosotros enviamos mensajes AL bot de Telegram del dueño via la API de Telegram.

    Función sendTelegramMessage(chatId, text, replyMarkup):
    - POST https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage
    - Body: { chat_id, text, parse_mode: 'HTML', reply_markup }
    - reply_markup opcional: botones inline
    - Timeout: 5000ms
    - Sin retry — notificaciones son best effort
    - Loggear resultado

    Función sendHandoverAlert(tenant, conversacion, mensaje):
    Construir mensaje formateado:
    ```
    🔔 <b>Nuevo mensaje — {tenant.nombre}</b>

    👤 Cliente: {conversacion.whatsapp_contact}
    💬 Mensaje: {mensaje.contenido}
    🕐 {hora actual}

    Responde aquí para contestarle directamente.
    Comandos: /tomar /bot /cerrar
    ```
    - Incluir inline keyboard con botones:
      [📞 Tomar conversación] → callback: tomar_{conversacionId}
      [🤖 Dejar al bot] → callback: bot_{conversacionId}

    Función sendTimeoutAlert(tenant, conversacion):
    ```
    ⏰ <b>Tiempo de respuesta agotado</b>
    El bot ha retomado la conversación con {conversacion.whatsapp_contact}
    en {tenant.nombre}.
    ```

    En src/notifications/index.js:
    - Re-exportar funciones de telegram.js
    - Función notifyHandover(tenant, conversacion, mensaje):
      * Obtener chatId del dueño: tenant.telegram_chat_id (agregar campo al schema)
      * Si no tiene telegram configurado: loggear warning, no fallar
      * Llamar sendHandoverAlert
    - Función notifyTimeout(tenant, conversacion): llamar sendTimeoutAlert

    AGREGAR al schema Prisma en tabla tenants:
    telegram_chat_id: String? (nullable — no todos tendrán Telegram)
  </action>
  <verify>
    Con TELEGRAM_BOT_TOKEN y chat_id reales en .env.test:
    sendTelegramMessage(chatId, "Test Moteland WA ✅") → mensaje llega a Telegram
  </verify>
  <done>
    Notificaciones Telegram funcionando, alerta formateada con HTML,
    botones inline para tomar/bot, campo telegram_chat_id en schema
  </done>
</task>

<task type="auto" id="3-3">
  <n>Sistema de comandos del dueño desde Telegram</n>
  <files>
    src/notifications/commandHandler.js
    src/api/telegram-webhook.js
  </files>
  <action>
    El dueño responde desde Telegram. Necesitamos:
    a) Capturar su respuesta y enviarla al WhatsApp del cliente
    b) Procesar comandos especiales: /tomar /bot /cerrar

    En src/api/telegram-webhook.js:
    Endpoint POST /api/telegram/webhook (nuevo endpoint, sin auth JWT — usa token propio):
    - Verificar que el request viene de Telegram (header o token query param)
    - Extraer update de Telegram: message o callback_query
    - Si es callback_query (botones inline): procesar en commandHandler
    - Si es message de texto:
      * Si empieza con /: procesar como comando
      * Si no: tratar como respuesta al cliente activo del dueño
    - Responder 200 siempre (Telegram requiere respuesta rápida)

    NOTA: Este webhook se registra en Telegram con:
    POST https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://wa-api.TU_DOMINIO.cl/api/telegram/webhook

    En src/notifications/commandHandler.js:
    Función handleTelegramUpdate(update, chatId):

    Obtener conversación activa del dueño:
    - Buscar tenant por telegram_chat_id = chatId
    - Buscar conversacion HUMANO más reciente del tenant

    COMANDOS:
    /tomar [opcional: número de WhatsApp]:
    - Cambiar conversacion.estado = 'HUMANO'
    - Asignar sin agente específico (el dueño responde directo desde Telegram)
    - Responder en Telegram: "✅ Tomaste el control. Escribe aquí para responderle."

    /bot:
    - Cambiar conversacion.estado = 'BOT'
    - Enviar al cliente: template "Un momento, te atiendo enseguida" (suave)
    - Responder en Telegram: "🤖 Bot retomó la conversación"

    /cerrar:
    - Cambiar conversacion.estado = 'CERRADA'
    - Responder en Telegram: "✅ Conversación cerrada"

    MENSAJE NORMAL (no comando):
    - Obtener conversación HUMANO activa del tenant
    - Si existe: enviar texto al WhatsApp del cliente via sender.js
    - Guardar mensaje como SALIENTE en DB
    - Emitir socket.io: 'new_message' para el dashboard
    - Responder en Telegram: "✅ Mensaje enviado"
    - Si no hay conversación activa: "⚠️ No hay conversación activa. Usa /tomar primero"

    CALLBACK_QUERY (botones inline):
    - tomar_{conversacionId}: ejecutar lógica de /tomar para esa conv específica
    - bot_{conversacionId}: ejecutar lógica de /bot para esa conv específica
    - Responder callback query para quitar el "cargando" del botón
  </action>
  <verify>
    Simular update de Telegram: POST /api/telegram/webhook con payload de mensaje
    Verificar: mensaje del dueño llega a WhatsApp del cliente
    Verificar: /tomar cambia estado en DB
    Verificar: /bot cambia estado en DB y bot retoma
  </verify>
  <done>
    Dueño puede responder desde Telegram, comandos /tomar /bot /cerrar funcionan,
    respuestas del dueño llegan al WhatsApp del cliente
  </done>
</task>

---

## Tareas — Wave 2 (requiere Wave 1)

<task type="auto" id="3-4">
  <n>Handover automático con timeout</n>
  <files>
    src/queue/workers/handoverWorker.js
    src/queue/workers/notificationWorker.js
    src/bot/handover.js
  </files>
  <action>
    En src/bot/handover.js:
    Función initiateHandover(conversacion, tenant, mensajeTrigger):
    1. Cambiar conversacion.estado = 'HUMANO' en DB
    2. Agregar a cola_espera
    3. Enviar al cliente: templates.HANDOVER_AVISO
    4. Encolar job en notificationQueue: NOTIFY_HANDOVER con datos de la conv
    5. Encolar job delayed en handoverQueue: HANDOVER_TIMEOUT_CHECK
       delay: 5 * 60 * 1000 (5 minutos)
       data: { conversacionId, tenantId, timestamp: Date.now() }
    6. Guardar en Redis: `handover:{conversacionId}` = timestamp inicio
       TTL: 10 minutos

    Función resolveHandover(conversacionId, resolucion):
    resolucion: 'tomado' | 'timeout' | 'cerrado'
    - Eliminar de cola_espera
    - Si timeout: cambiar estado = 'BOT', notifyTimeout al dueño
    - Si tomado: estado = 'HUMANO', el dueño responde
    - Si cerrado: estado = 'CERRADA'
    - Limpiar Redis key `handover:{conversacionId}`

    En src/queue/workers/handoverWorker.js:
    Worker que procesa handoverQueue:
    Job HANDOVER_TIMEOUT_CHECK:
    - Verificar si la conversación sigue en estado HUMANO
    - Verificar en Redis si handover sigue activo (no fue resuelto)
    - Si sigue sin respuesta del dueño: llamar resolveHandover(id, 'timeout')
    - Si ya fue respondido: no hacer nada (job obsoleto)

    En src/queue/workers/notificationWorker.js:
    Worker que procesa notificationQueue:
    Job NOTIFY_HANDOVER:
    - Cargar tenant y conversacion de DB
    - Cargar último mensaje de DB
    - Llamar notifyHandover(tenant, conversacion, mensaje)
    Job NOTIFY_TIMEOUT:
    - Llamar notifyTimeout(tenant, conversacion)
  </action>
  <verify>
    Simular mensaje DESCONOCIDO → verificar en DB: estado='HUMANO', registro en cola_espera
    Verificar: notificación Telegram enviada (con token real) o log de intento
    Esperar 5 min (o mockear el tiempo) → verificar timeout: estado='BOT' automáticamente
  </verify>
  <done>
    Handover automático funciona, timeout de 5 min restaura el bot,
    dueño recibe notificación con botones
  </done>
</task>

<task type="auto" id="3-5">
  <n>Integrar handover en WhatsAppAgent</n>
  <files>
    src/bot/agent.js (actualizar)
    src/queue/workers/messageWorker.js
  </files>
  <action>
    Actualizar src/bot/agent.js:
    En el flujo de process(), después de ejecutar el handler:
    - Si resultado.handover === true: llamar initiateHandover()
    - Si conversacion.estado === 'HUMANO' al inicio: skip procesamiento bot
      Y en lugar de ignorar el mensaje: guardar en DB + emitir socket.io
      para que el dueño vea el mensaje en dashboard aunque esté en modo humano

    Separar en src/queue/workers/messageWorker.js:
    - El procesador de BullMQ para messageQueue (separar de queue/index.js)
    - Importar whatsappAgent
    - Manejar el caso donde conversacion está en modo HUMANO:
      * Guardar mensaje en DB
      * Emitir socket.io 'new_message'
      * NO procesar con bot
      * NO notificar al dueño de nuevo (ya fue notificado al inicio)

    Actualizar worker/index.js:
    - Importar e iniciar messageWorker, handoverWorker, notificationWorker
    - Los 3 workers corren en el mismo proceso (worker/index.js)
    - Log al arrancar: "🔄 Workers iniciados: message, handover, notification"
  </action>
  <verify>
    Flujo completo:
    1. Mensaje DESCONOCIDO → handover iniciado → estado HUMANO
    2. Otro mensaje del mismo cliente → guardado en DB, NO procesado por bot
    3. Dueño responde en Telegram → llega al cliente
    4. /bot → estado vuelve a BOT
    5. Mensaje siguiente → bot procesa normalmente
  </verify>
  <done>
    Agent integrado con handover, mensajes en modo HUMANO se guardan pero no se procesan,
    3 workers corriendo en paralelo
  </done>
</task>

---

## Tareas — Wave 3 (requiere Wave 2)

<task type="auto" id="3-6">
  <n>Migración Prisma para nuevos campos y tabla cola</n>
  <files>
    prisma/schema.prisma (actualizar)
    prisma/migrations/ (nueva migración)
  </files>
  <action>
    Agregar a tabla tenants:
    - telegram_chat_id: String? (para recibir notificaciones)
    - telegram_bot_token: String? (el token del bot Nanobot del dueño)
      NOTA: cada tenant puede tener su propio bot de Telegram,
      o todos pueden usar el mismo bot central si el dueño quiere

    Agregar a tabla conversaciones:
    - handover_at: DateTime? (cuándo se inició el handover)
    - handover_resolved_at: DateTime? (cuándo se resolvió)
    - handover_resolution: String? ('tomado'|'timeout'|'cerrado')

    Tabla cola_espera (verificar que existe con estos campos):
    - id, tenant_id, conversacion_id, prioridad, created_at
    - Si falta algún campo: agregar en esta migración

    Ejecutar: npx prisma migrate dev --name add-handover-telegram

    Actualizar seed para incluir telegram_chat_id de prueba en el tenant test.

    Agregar a .env.example:
    TELEGRAM_BOT_TOKEN=     # Token del bot Telegram central (BotFather)
    TELEGRAM_WEBHOOK_SECRET= # Secret para verificar updates de Telegram
  </action>
  <verify>npx prisma migrate status → todas las migraciones aplicadas</verify>
  <done>Schema actualizado con campos de handover y Telegram, migración aplicada</done>
</task>

<task type="auto" id="3-7">
  <n>Endpoint API para estado de cola y métricas handover</n>
  <files>
    src/api/queue.js
    src/api/handover.js
  </files>
  <action>
    En src/api/queue.js:
    GET /api/queue/stats (requiere JWT):
    - Llamar getQueueStats() de src/queue/index.js
    - Retornar: { waiting, active, completed, failed, deadLetter }

    GET /api/queue/waiting (requiere JWT):
    - Consultar tabla cola_espera del tenant (req.tenantId)
    - JOIN con conversaciones para obtener datos del cliente
    - Incluir: tiempo en cola (now - created_at en segundos)
    - Ordenar por prioridad DESC, created_at ASC

    En src/api/handover.js:
    GET /api/handover/active (requiere JWT):
    - Conversaciones en estado HUMANO del tenant
    - Incluir: agente asignado (si hay), tiempo desde handover_at

    POST /api/handover/:conversacionId/resolve (requiere JWT):
    - Body: { resolucion: 'bot'|'cerrar' }
    - Llamar resolveHandover() con la resolución
    - Emitir socket.io: 'handover_resolved'

    Montar estas rutas en src/index.js bajo /api/
  </action>
  <verify>
    Con JWT válido:
    GET /api/queue/stats → { waiting: N, active: N, ... }
    GET /api/queue/waiting → array de conversaciones esperando
  </verify>
  <done>API endpoints de cola y handover funcionando, protegidos con JWT</done>
</task>

---

## Tareas — Wave 4 (cierre)

<task type="auto" id="3-8">
  <n>Registro webhook Telegram y test end-to-end completo</n>
  <files>
    scripts/setup-telegram-webhook.sh
    docs/test-fase3.sh
    docs/configurar-telegram.md
  </files>
  <action>
    En scripts/setup-telegram-webhook.sh:
    Script para registrar el webhook de Telegram:
    ```bash
    curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
      -H "Content-Type: application/json" \
      -d "{\"url\": \"https://wa-api.${DOMAIN}/api/telegram/webhook\",
           \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\"}"
    ```
    Verificar registro:
    ```bash
    curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
    ```

    En docs/configurar-telegram.md:
    Guía paso a paso para el dueño:
    1. Crear bot en BotFather: /newbot
    2. Copiar token al .env: TELEGRAM_BOT_TOKEN
    3. Obtener su chat_id: escribir a @userinfobot
    4. Configurar en DB: UPDATE tenants SET telegram_chat_id='XXX' WHERE id='YYY'
    5. Ejecutar: bash scripts/setup-telegram-webhook.sh
    6. Test: escribir al número WhatsApp algo que el bot no entienda
       → debe llegar alerta al Telegram del dueño

    En docs/test-fase3.sh:
    Test completo del flujo handover:
    1. Simular mensaje DESCONOCIDO via webhook
    2. Verificar en DB: conversacion.estado = 'HUMANO'
    3. Simular respuesta del dueño via POST /api/telegram/webhook
    4. Verificar en DB: mensaje SALIENTE guardado
    5. Simular /bot command
    6. Verificar en DB: conversacion.estado = 'BOT'

    Rebuild y deploy final:
    docker compose build wa-api wa-worker
    docker compose up -d
    docker compose logs --tail=20
  </action>
  <verify>
    bash docs/test-fase3.sh → todos los pasos pasan
    Logs sin errores de handover
    Estado de conversación cambia correctamente en cada paso
  </verify>
  <done>
    Flujo handover completo probado.
    Script de configuración Telegram documentado.
    Commit: feat(fase-3): handover humano con Telegram, cola robusta con retry y dead letter
  </done>
</task>

---

## Variables de entorno nuevas en esta fase

Agregar a .env:
```
# Telegram (para notificaciones al dueño)
TELEGRAM_BOT_TOKEN=         # Obtener de @BotFather
TELEGRAM_WEBHOOK_SECRET=    # Generar: openssl rand -hex 32
```

Agregar a .env.example también.

## Resumen de archivos nuevos en Fase 3

```
src/
├── notifications/
│   ├── telegram.js          ← Envío mensajes + alertas al dueño
│   ├── commandHandler.js    ← Procesa /tomar /bot /cerrar y respuestas
│   └── index.js             ← Re-exports
├── bot/
│   └── handover.js          ← Lógica initiateHandover + resolveHandover
├── queue/
│   ├── queues.js            ← 4 colas definidas
│   ├── jobs.js              ← Constantes de nombres de jobs
│   └── workers/
│       ├── messageWorker.js    ← Separado de queue/index.js
│       ├── handoverWorker.js   ← Timeout checker
│       └── notificationWorker.js ← Telegram notifier
├── api/
│   ├── queue.js             ← Stats y waiting list
│   ├── handover.js          ← Resolver handover desde API
│   └── telegram-webhook.js  ← Recibir updates de Telegram
scripts/
└── setup-telegram-webhook.sh
docs/
├── test-fase3.sh
└── configurar-telegram.md
prisma/
└── migrations/ (nueva)
```

## Commit esperado

`feat(fase-3): handover humano Telegram, cola robusta retry/DLQ, timeout automático`
