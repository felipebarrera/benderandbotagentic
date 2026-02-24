# Fase 2 — Bot IA + Integración PMS
# PLAN completo para /gsd:execute-phase 2 → Antigravity /execute

## Contexto de la fase

La infraestructura existe y los mensajes llegan a la DB.
Ahora el sistema debe leerlos, entender qué quiere el cliente,
consultar el PMS Moteland para obtener información real,
y responder de vuelta por WhatsApp Cloud API.

Al final de esta fase: un cliente real escribe al número de WhatsApp
y recibe una respuesta con disponibilidad o precios reales en < 3 segundos.

## Señal de éxito

```
Cliente escribe: "hola tienen pieza para esta noche?"
Bot responde en < 3s: "¡Hola! Sí tenemos disponibilidad para esta noche.
Tenemos habitación estándar a $35.000 y suite a $55.000.
¿Para cuántas personas?"
```

---

## Tareas — Wave 1 (paralelas, independientes)

<task type="auto" id="2-1">
  <n>Cliente HTTP para PMS Moteland legacy</n>
  <files>
    src/moteland/client.js
    src/moteland/formatters.js
  </files>
  <action>
    En src/moteland/client.js:
    - Clase MotelandClient con baseURL = config.MOTELAND_API_URL (http://motelmulti:3000)
    - Header en todos los requests: X-Internal-Secret: config.INTERNAL_API_SECRET
    - Timeout: 5000ms en todos los requests
    - Retry automático: 2 intentos con 500ms de delay si falla
    - Métodos:

      async getDisponibilidad(tenantId, fecha, personas):
        GET /api/habitaciones/disponibles?tenantId=X&fecha=YYYY-MM-DD&personas=N
        Retorna: array de habitaciones disponibles con id, tipo, capacidad, precio
        Si el PMS no responde: retornar array vacío (no lanzar error — el bot debe
        poder decir "en este momento no puedo verificar disponibilidad")

      async getPrecios(tenantId):
        GET /api/habitaciones/precios?tenantId=X
        Retorna: array de tipos de habitación con precio_base, precio_fin_semana
        Cache en Redis: 10 minutos (los precios no cambian frecuentemente)

      async crearReservaSimple(tenantId, datos):
        POST /api/reservas/simple
        Body: { tenantId, fecha, personas, contacto: { nombre, whatsapp } }
        Retorna: { reservaId, confirmacion, habitacion }
        Sin retry — operación de escritura

      async healthCheck():
        GET /health del PMS
        Retorna: boolean

    - Exportar singleton: export const motelandClient = new MotelandClient()
    - Loggear cada request con logger.info incluyendo tenantId y duración

    En src/moteland/formatters.js:
    - formatDisponibilidad(habitaciones): convierte array a texto natural en español chileno
      Ej: "Tenemos disponible:\n• Habitación Estándar — $35.000\n• Suite — $55.000"
    - formatPrecios(precios): texto con lista de precios
    - formatReservaConfirmada(reserva): "¡Reserva confirmada! Tu código es #1234. Te esperamos."
    - formatSinDisponibilidad(): "Lo sentimos, no tenemos disponibilidad para esa fecha."
    - formatErrorPMS(): "En este momento no podemos verificar disponibilidad. 
      Te comunicamos con un ejecutivo."
  </action>
  <verify>
    Test unitario: mockear fetch, llamar getDisponibilidad, verificar URL y headers correctos.
    Test con PMS real: node -e "import('./src/moteland/client.js').then(m => m.motelandClient.healthCheck().then(console.log))"
  </verify>
  <done>
    Cliente HTTP funciona con retry, cache en Redis para precios,
    formateadores retornan texto en español natural
  </done>
</task>

<task type="auto" id="2-2">
  <n>Sistema de prompts personalizables por tenant</n>
  <files>
    src/bot/prompts.js
    src/bot/promptManager.js
  </files>
  <action>
    En src/bot/prompts.js:
    - SYSTEM_PROMPT_BASE: prompt base del sistema. Debe instruir al modelo a:
      * Ser un asistente de atención al cliente para el negocio {nombre_negocio}
      * Responder SIEMPRE en español chileno informal pero respetuoso
      * Ser conciso — máximo 3 oraciones por respuesta
      * NUNCA inventar precios ni disponibilidad — solo usar datos provistos
      * NUNCA mencionar que es un bot a menos que le pregunten directamente
      * Si le preguntan si es bot: "Soy el asistente virtual de {nombre_negocio}"
      * Para cualquier consulta compleja: ofrecer conectar con un ejecutivo

    - INTENT_DETECTION_PROMPT: prompt para clasificar intención. Debe:
      * Clasificar el mensaje en una de: DISPONIBILIDAD | PRECIOS | RESERVA |
        SALUDO | DESPEDIDA | CONSULTA_GENERAL | DESCONOCIDO
      * Extraer entidades: fecha (si la hay), personas (si las hay), tipo_hab (si hay)
      * Responder SOLO con JSON válido:
        {"intent": "DISPONIBILIDAD", "fecha": "2025-03-15", "personas": 2, "tipo": null}
      * Si no hay fecha explícita y hablan de "hoy/esta noche": usar fecha actual
      * Si no hay fecha y hablan de "mañana": usar fecha siguiente

    En src/bot/promptManager.js:
    - Función buildSystemPrompt(tenant):
      * Tomar SYSTEM_PROMPT_BASE
      * Reemplazar {nombre_negocio} con tenant.nombre
      * Si tenant.prompt_personalizado existe: anexarlo al final del prompt base
      * Cache en Redis: 30 minutos por tenant_id
    - Función buildIntentPrompt(mensaje): retornar INTENT_DETECTION_PROMPT
    - Exportar ambas funciones
  </action>
  <verify>
    buildSystemPrompt({nombre:'Motel Test', prompt_personalizado: null}) retorna string con "Motel Test"
    buildSystemPrompt({nombre:'Motel X', prompt_personalizado: 'Somos pet-friendly'}) incluye el texto extra
  </verify>
  <done>Prompts configurables por tenant, cacheados en Redis, español chileno</done>
</task>

<task type="auto" id="2-3">
  <n>Cliente OpenAI para detección de intención</n>
  <files>
    src/bot/intentDetector.js
  </files>
  <action>
    En src/bot/intentDetector.js:
    - Importar OpenAI SDK
    - Función detectIntent(mensaje, fechaActual):
      * Llamar GPT-4o-mini con temperature: 0 (respuestas deterministas)
      * max_tokens: 150 (solo necesita el JSON)
      * Timeout: 3000ms
      * Parsear respuesta JSON
      * Si falla el parse: retornar {intent: 'DESCONOCIDO', fecha: null, personas: null}
      * Si OpenAI no responde en 3s: retornar {intent: 'DESCONOCIDO', ...} — nunca bloquear

    - Función generateResponse(systemPrompt, historial, contexto):
      * Llamar GPT-4o-mini con temperature: 0.7 (respuestas más naturales)
      * max_tokens: 200
      * Historial: últimos 5 mensajes de la conversación para contexto
      * contexto: objeto con datos del PMS (disponibilidad, precios, etc.)
      * Incluir contexto en el system prompt si existe
      * Timeout: 5000ms
      * Si falla: retornar null (el caller decide qué hacer)

    - Ambas funciones logean duración con logger.info
    - Exportar ambas funciones
  </action>
  <verify>
    detectIntent("tienen pieza para mañana?", "2025-03-14") → {intent:"DISPONIBILIDAD", fecha:"2025-03-15", personas:null}
    detectIntent("hola buenos días") → {intent:"SALUDO", ...}
    detectIntent("cuánto sale una suite?") → {intent:"PRECIOS", ...}
  </verify>
  <done>
    Detección de intención funciona con GPT-4o-mini, retorna JSON válido,
    nunca bloquea si OpenAI falla
  </done>
</task>

---

## Tareas — Wave 2 (requiere Wave 1 completa)

<task type="auto" id="2-4">
  <n>WhatsApp Cloud API — envío de mensajes</n>
  <files>
    src/whatsapp/sender.js
    src/whatsapp/templates.js
  </files>
  <action>
    En src/whatsapp/sender.js:
    - Función sendTextMessage(to, text, phoneId, token):
      * POST a https://graph.facebook.com/v18.0/{phoneId}/messages
      * Header: Authorization: Bearer {token}
      * Body: { messaging_product:"whatsapp", to, type:"text", text:{body:text} }
      * Timeout: 10000ms
      * Si falla: loggear error con to y primeros 20 chars del texto — no relanzar
      * Retornar: { success: boolean, messageId, error }

    - Función sendTypingIndicator(to, phoneId, token):
      * Enviar "leyendo" antes de responder (marca azul)
      * POST messages con type:"reaction" no — usar read receipt:
        POST /messages con { status:"read", message_id: lastMessageId }
      * Sin retry — best effort

    - Función markAsRead(messageId, phoneId, token):
      * Marcar mensaje como leído
      * Best effort, sin retry

    En src/whatsapp/templates.js:
    - BIENVENIDA: mensaje de primera vez que alguien escribe
    - FUERA_HORARIO: "Hola! En este momento estamos fuera de horario de atención.
      Te responderemos a partir de las {hora_inicio}."
    - HANDOVER_AVISO: "Un ejecutivo te atenderá en breve."
    - exportar objeto con todos los templates
  </action>
  <verify>
    Test con número real de sandbox Meta: sendTextMessage("+56912345678", "Test", PHONE_ID, TOKEN)
    Verificar que el mensaje llega al WhatsApp
  </verify>
  <done>
    Envío de mensajes a WhatsApp Cloud API funcionando,
    typing indicator, read receipts, templates básicos
  </done>
</task>

<task type="auto" id="2-5">
  <n>Handlers por intención</n>
  <files>
    src/bot/handlers/disponibilidad.js
    src/bot/handlers/precios.js
    src/bot/handlers/reserva.js
    src/bot/handlers/saludo.js
    src/bot/handlers/desconocido.js
  </files>
  <action>
    Cada handler recibe: { tenant, conversacion, mensaje, entidades }
    Cada handler retorna: { respuesta: string, handover: boolean, cerrar: boolean }

    disponibilidad.js:
    - Llamar motelandClient.getDisponibilidad(tenant.id, entidades.fecha, entidades.personas)
    - Si hay resultados: formatDisponibilidad(habitaciones)
    - Si sin resultados: formatSinDisponibilidad()
    - Si error PMS: formatErrorPMS() + handover:true

    precios.js:
    - Llamar motelandClient.getPrecios(tenant.id)
    - Si hay resultados: formatPrecios(precios)
    - Si error PMS: "En este momento no podemos mostrar precios. ¿Quieres hablar con un ejecutivo?"

    reserva.js:
    - Si faltan datos (fecha, personas): preguntar lo que falta
      "¿Para qué fecha necesitas la reserva?" o "¿Para cuántas personas?"
    - Si tiene todos los datos: llamar crearReservaSimple()
    - formatReservaConfirmada(resultado)
    - Si falla: handover:true

    saludo.js:
    - Usar generateResponse() con system prompt del tenant
    - Pasar contexto: {tipo:"saludo", hora_del_dia: mañana|tarde|noche}
    - El modelo genera saludo personalizado

    desconocido.js:
    - Usar generateResponse() para intentar responder con contexto general
    - Si el modelo no genera respuesta relevante: handover:true
    - Respuesta máxima: "No entendí bien tu consulta. Te conecto con un ejecutivo."
    - Siempre handover:true para DESCONOCIDO en v1
  </action>
  <verify>
    Test cada handler con datos mockeados
    Verificar que desconocido.js siempre retorna handover:true
    Verificar que disponibilidad.js retorna formatErrorPMS si PMS no responde
  </verify>
  <done>5 handlers implementados, cada uno maneja su caso de éxito y error</done>
</task>

---

## Tareas — Wave 3 (requiere Wave 2 completa)

<task type="auto" id="2-6">
  <n>WhatsAppAgent — clase principal del bot</n>
  <files>
    src/bot/agent.js
  </files>
  <action>
    En src/bot/agent.js:
    Clase WhatsAppAgent con método principal process(rawMessage, tenant):

    FLUJO COMPLETO:
    1. Verificar que tenant está activo (tenant.activo === true)
    2. Verificar horario de atención:
       - Comparar hora actual con tenant.horario_inicio / horario_fin
       - Si fuera de horario Y modo_bot: enviar FUERA_HORARIO template y terminar
    3. Buscar o crear conversacion en DB por (tenant_id, whatsapp_contact)
    4. Guardar mensaje entrante en DB (si no fue guardado en webhook)
    5. Verificar si conversacion.estado === 'HUMANO':
       - Si sí: NO procesar con bot — el worker de handover lo maneja
       - Retornar sin hacer nada
    6. Verificar si tenant.modo_bot === false:
       - Si sí: encolar para handover directo
       - Retornar
    7. Marcar mensaje como leído (markAsRead)
    8. Detectar intención: detectIntent(mensaje.contenido, fechaHoy)
    9. Seleccionar handler según intent
    10. Ejecutar handler → { respuesta, handover, cerrar }
    11. Si handover: cambiar conversacion.estado = 'HUMANO', encolar notificación
    12. Si no handover: enviar respuesta con sendTextMessage
    13. Guardar mensaje saliente en DB
    14. Emitir evento socket.io: 'message_processed' con conversacion actualizada

    Manejar TODOS los errores con try/catch.
    Si cualquier paso falla: loggear + handover como fallback (nunca dejar al cliente sin respuesta).

    Exportar: export const whatsappAgent = new WhatsAppAgent()
  </action>
  <verify>
    Test con mensaje simulado para tenant de prueba:
    await whatsappAgent.process({from:"+56912345678", body:"hola"}, tenantTest)
    Verificar: mensaje guardado en DB, respuesta enviada (o intento de envío)
  </verify>
  <done>
    Agente orquesta el flujo completo, maneja todos los estados,
    nunca deja al cliente sin respuesta aunque falle algo interno
  </done>
</task>

<task type="auto" id="2-7">
  <n>Integrar agent en el worker BullMQ</n>
  <files>
    src/queue/processor.js
    src/queue/index.js (actualizar)
    worker/index.js
  </files>
  <action>
    Actualizar src/queue/processor.js:
    - Función processMessageJob(job):
      * Extraer { rawMessage, tenantId } del job.data
      * Buscar tenant en DB (con cache Redis 5min)
      * Si tenant no existe: logger.warn + return (no retry)
      * Llamar whatsappAgent.process(rawMessage, tenant)
      * Si éxito: job completo
      * Si error: relanzar para que BullMQ haga retry

    Actualizar src/queue/index.js:
    - Asegurarse que el worker procesa la cola 'message-processing'
    - Configuración: { concurrency: 5 } (5 mensajes simultáneos)
    - onCompleted: logger.info con job.id y duración
    - onFailed: logger.error con job.id, error, intentos restantes

    Actualizar worker/index.js:
    - Importar y arrancar el queue processor
    - Manejar SIGTERM para shutdown graceful (esperar jobs activos)
    - Logger.info "🔄 Worker BullMQ iniciado" al arrancar
  </action>
  <verify>
    Arrancar worker: node worker/index.js
    Enviar job manual a la cola via Redis CLI:
    LPUSH bull:message-processing:wait '{"data":{"tenantId":"test","rawMessage":{"from":"+56900000001","body":"hola"}}}'
    Verificar logs del worker: job procesado, respuesta enviada
  </verify>
  <done>
    Worker procesa jobs de la cola, llama al agente,
    maneja retry automático, graceful shutdown
  </done>
</task>

---

## Tareas — Wave 4 (cierre y verificación)

<task type="auto" id="2-8">
  <n>Historial de conversación para contexto del bot</n>
  <files>
    src/bot/contextBuilder.js
  </files>
  <action>
    En src/bot/contextBuilder.js:
    - Función getConversationHistory(conversacionId, limit=5):
      * Obtener los últimos N mensajes de la conversación de DB
      * Ordenados por created_at ASC
      * Formatear para OpenAI:
        [{role: "user"|"assistant", content: mensaje.contenido}]
      * ENTRANTE → role:"user", SALIENTE → role:"assistant"
      * Cache en Redis: 60 segundos (se invalida cuando llega mensaje nuevo)

    - Función buildContext(intent, entidades, pmsData):
      * Construir objeto de contexto para incluir en el prompt
      * Si intent=DISPONIBILIDAD: incluir resultado de PMS
      * Si intent=PRECIOS: incluir lista de precios
      * Serializar a string: "Información del sistema: ..."
      * Este string se incluye en el system prompt de generateResponse

    Integrar en WhatsAppAgent.process():
    - Antes de llamar generateResponse: obtener historial y buildContext
    - Pasar ambos a generateResponse
  </action>
  <verify>
    Conversación de 3 mensajes → getConversationHistory retorna array de 3 items formateados
    Bot recuerda que ya preguntó la fecha en el turno anterior
  </verify>
  <done>Bot tiene contexto de la conversación, no repite preguntas ya hechas</done>
</task>

<task type="auto" id="2-9">
  <n>Test end-to-end con número WhatsApp real</n>
  <files>
    docs/test-fase2.sh
    docs/test-fase2.md
  </files>
  <action>
    En docs/test-fase2.sh:
    Script que simula payload completo de Meta con firma HMAC correcta.
    Incluir 3 escenarios:
    1. Saludo → bot responde con bienvenida
    2. "tienen pieza para esta noche?" → bot consulta PMS y responde con disponibilidad
    3. "cuanto vale la suite" → bot responde con precios

    En docs/test-fase2.md:
    Documentar:
    - Cómo configurar número de sandbox de Meta para pruebas
    - Cómo agregar número de prueba en Meta Business
    - Cómo ver los mensajes enviados en el panel de Meta
    - Cómo verificar en DB que el flujo completo funcionó

    Verificación Docker completa:
    docker compose build wa-api wa-worker
    docker compose up -d
    bash docs/test-fase2.sh
    docker compose logs wa-api wa-worker --tail=30
  </action>
  <verify>
    Los 3 escenarios del script retornan 200
    En logs del worker se ven los 3 jobs procesados
    En tabla mensajes existen los mensajes entrantes Y salientes
    En panel Meta aparecen los mensajes enviados (si sandbox configurado)
  </verify>
  <done>
    Test end-to-end documentado y funcionando.
    Bot responde con datos reales del PMS en < 3 segundos.
    Commit: feat(fase-2): bot IA funcionando con integración PMS real
  </done>
</task>

---

## Resumen de archivos nuevos en Fase 2

```
src/
├── moteland/
│   ├── client.js          ← HTTP client para PMS legacy
│   └── formatters.js      ← Texto natural en español
├── bot/
│   ├── agent.js           ← Orquestador principal
│   ├── intentDetector.js  ← GPT-4o-mini para clasificar
│   ├── prompts.js         ← Prompts base del sistema
│   ├── promptManager.js   ← Prompts cacheados por tenant
│   ├── contextBuilder.js  ← Historial + contexto PMS
│   └── handlers/
│       ├── disponibilidad.js
│       ├── precios.js
│       ├── reserva.js
│       ├── saludo.js
│       └── desconocido.js
└── whatsapp/
    ├── sender.js          ← Envío mensajes Cloud API
    └── templates.js       ← Mensajes predefinidos

worker/
└── index.js              ← Actualizado con agent

docs/
├── test-fase2.sh
└── test-fase2.md
```

## Commit esperado al finalizar

`feat(fase-2): bot IA con integración PMS — responde disponibilidad y precios en tiempo real`
