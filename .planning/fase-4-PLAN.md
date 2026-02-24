# Fase 4 — Autenticación JWT y API REST Completa
# PLAN completo para /gsd:execute-phase 4 → Antigravity /execute

## Contexto de la fase

La lógica de negocio está completa (bot + handover + colas).
Ahora necesitamos el sistema de autenticación seguro y la API REST
que alimentará el dashboard React en la Fase 5.

Al final de esta fase: el dueño puede hacer login, obtener un JWT,
y consumir todos los datos de su negocio via API protegida.

## Señal de éxito

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.cl","password":"admin123"}' | jq -r '.accessToken')

# Usar el token
curl http://localhost:3001/api/conversations \
  -H "Authorization: Bearer $TOKEN"
# → {"data":[...],"total":N,"page":1}
```

---

## Tareas — Wave 1 (paralelas, independientes)

<task type="auto" id="4-1">
  <n>Sistema JWT completo — login, refresh, logout</n>
  <files>
    src/auth/jwt.js
    src/auth/service.js
    src/api/auth.js
    src/middleware/auth.js (refactor)
  </files>
  <action>
    En src/auth/jwt.js:
    Funciones puras de JWT sin efectos secundarios:

    generateAccessToken(payload):
    - payload: { agentId, tenantId, email, rol }
    - sign con JWT_SECRET
    - expiresIn: '15m'
    - retornar string token

    generateRefreshToken(payload):
    - sign con JWT_REFRESH_SECRET
    - expiresIn: '7d'
    - retornar string token

    verifyAccessToken(token):
    - verify con JWT_SECRET
    - Si expirado o inválido: throw Error con mensaje claro
    - retornar payload decodificado

    verifyRefreshToken(token):
    - verify con JWT_REFRESH_SECRET
    - retornar payload o throw

    En src/auth/service.js:
    Función login(email, password):
    1. Buscar agente por email en DB (incluir tenant)
    2. Si no existe: throw Error('Credenciales inválidas') — mismo mensaje que password wrong
    3. Verificar password: bcrypt.compare(password, agente.password_hash)
    4. Si falla: throw Error('Credenciales inválidas')
    5. Generar accessToken y refreshToken
    6. Guardar refreshToken en Redis:
       key: `refresh:{agentId}:{tokenId}` (tokenId = uuid corto)
       value: refreshToken
       TTL: 7 días
       Permite múltiples sesiones simultáneas por agente
    7. Actualizar agente.ultimo_ping = now() en DB
    8. Retornar: { accessToken, refreshToken, agente: { id, email, nombre, rol, tenantId } }

    Función refresh(refreshToken):
    1. Verificar refreshToken con verifyRefreshToken
    2. Verificar que existe en Redis (no fue revocado)
    3. Generar nuevos accessToken Y refreshToken (rotación)
    4. Eliminar el refreshToken viejo de Redis
    5. Guardar el nuevo refreshToken en Redis
    6. Retornar: { accessToken, refreshToken }

    Función logout(agentId, refreshToken):
    1. Decodificar refreshToken para obtener tokenId
    2. Eliminar de Redis: `refresh:{agentId}:{tokenId}`
    3. Retornar void

    Función logoutAll(agentId):
    1. Eliminar todos los keys que matcheen `refresh:{agentId}:*`
    2. Útil si el dueño sospecha que alguien tiene acceso no autorizado

    En src/api/auth.js:
    POST /api/auth/login:
    - Validar body: email (string, email format), password (string, min 6)
    - Llamar authService.login()
    - Si error: 401 con { error: 'Credenciales inválidas' }
    - Si ok: 200 con { accessToken, refreshToken, user }
    - Rate limit específico: 5 intentos por IP por minuto (protección brute force)

    POST /api/auth/refresh:
    - Extraer refreshToken del body o cookie httpOnly
    - Llamar authService.refresh()
    - Si error: 401
    - Si ok: 200 con nuevos tokens

    POST /api/auth/logout:
    - Requiere accessToken válido (middleware auth)
    - Llamar authService.logout()
    - 200 siempre

    POST /api/auth/logout-all:
    - Requiere accessToken válido
    - Llamar authService.logoutAll()
    - 200 siempre

    GET /api/auth/me:
    - Requiere accessToken válido
    - Retornar datos del agente autenticado (sin password_hash)

    En src/middleware/auth.js (refactor del existente):
    - Extraer token del header: Authorization: Bearer {token}
    - Si no hay header: 401
    - Llamar verifyAccessToken()
    - Si error: 401 con mensaje específico ('Token expirado' vs 'Token inválido')
    - Si ok: req.agentId, req.tenantId, req.agentRol en el request
    - Exportar: authMiddleware (para rutas privadas)
    - Exportar: adminOnly (verifica que rol === 'ADMIN')
  </action>
  <verify>
    POST /api/auth/login con credenciales del seed → 200 con tokens
    POST /api/auth/refresh con refreshToken válido → nuevos tokens
    GET /api/auth/me con accessToken → datos del agente
    GET /api/auth/me con token expirado → 401 "Token expirado"
    5 intentos fallidos de login → 429
  </verify>
  <done>
    JWT completo con rotación de refresh tokens, almacenamiento Redis,
    brute force protection, logout individual y total
  </done>
</task>

<task type="auto" id="4-2">
  <n>API REST — Conversaciones</n>
  <files>
    src/api/conversations.js
  </files>
  <action>
    TODOS los endpoints requieren authMiddleware.
    TODOS los queries filtran por req.tenantId (nunca cross-tenant).

    GET /api/conversations:
    Query params:
    - estado: 'BOT'|'HUMANO'|'CERRADA'|'todas' (default: todas excepto CERRADA)
    - page: número (default 1)
    - limit: número (default 20, max 100)
    - search: texto (buscar en whatsapp_contact o contact_name)
    - desde: ISO date (filtrar por ultimo_mensaje_at)

    Response:
    {
      data: [ conversacion con último mensaje incluido ],
      total: número total,
      page: actual,
      totalPages: total / limit
    }

    GET /api/conversations/:id:
    - Verificar que conversacion.tenant_id === req.tenantId
    - Incluir: agente asignado, últimos 50 mensajes, info del tenant
    - 404 si no existe o no pertenece al tenant

    GET /api/conversations/:id/messages:
    Query params: page, limit (default 50), cursor (para infinite scroll)
    - Mensajes ordenados DESC (más reciente primero)
    - Cursor-based pagination para el chat en tiempo real

    PATCH /api/conversations/:id:
    Body permitido: { estado, agente_id, contact_name }
    - Solo campos explícitamente permitidos (whitelist)
    - Si cambia estado a HUMANO: verificar agente_id existe y pertenece al tenant
    - Emitir socket.io 'conversation_updated' tras guardar
    - 200 con conversacion actualizada

    POST /api/conversations/:id/messages:
    Body: { contenido, tipo: 'TEXTO' }
    - Agente envía mensaje manual desde dashboard
    - Guardar en DB como SALIENTE
    - Enviar via WhatsApp sender
    - Emitir socket.io 'new_message'
    - 201 con mensaje creado

    DELETE /api/conversations/:id (solo ADMIN):
    - Soft delete: updated_at + estado = CERRADA
    - No borrar mensajes (auditoría)
  </action>
  <verify>
    GET /api/conversations → lista paginada filtrada por tenant
    GET /api/conversations/:id → detalle con mensajes
    PATCH /api/conversations/:id con estado:'CERRADA' → actualiza DB y emite socket
    POST /api/conversations/:id/messages → mensaje guardado y "enviado" a WhatsApp
  </verify>
  <done>CRUD completo de conversaciones, multi-tenant seguro, paginación, socket.io</done>
</task>

<task type="auto" id="4-3">
  <n>API REST — Agentes y configuración tenant</n>
  <files>
    src/api/agents.js
    src/api/tenants.js
  </files>
  <action>
    En src/api/agents.js:
    TODOS requieren authMiddleware. CREATE/UPDATE/DELETE requieren adminOnly.

    GET /api/agents:
    - Listar agentes del tenant (req.tenantId)
    - Incluir: online status, ultimo_ping, conversaciones activas asignadas (count)
    - Nunca incluir password_hash

    GET /api/agents/:id:
    - Verificar que pertenece al tenant
    - Incluir conversaciones activas asignadas

    POST /api/agents (adminOnly):
    Body: { email, password, nombre, rol }
    - Validar email único en el sistema
    - Hash password con bcrypt (rounds: 12)
    - tenant_id = req.tenantId (agente siempre del mismo tenant que el admin)
    - 201 con agente creado (sin password_hash)

    PATCH /api/agents/:id (adminOnly):
    Body permitido: { nombre, rol, password_nuevo }
    - Si password_nuevo: re-hashear, invalidar todas las sesiones del agente
    - No permitir cambiar email ni tenant_id

    DELETE /api/agents/:id (adminOnly):
    - No borrar si tiene conversaciones HUMANO activas asignadas
    - Soft delete o reasignar conversaciones antes
    - Invalidar todas las sesiones del agente

    PATCH /api/agents/:id/status:
    Body: { online: boolean }
    - El agente actualiza su propio estado
    - Solo puede actualizar su propio id (verificar req.agentId === id)
    - Guardar en Redis: `agent:online:{agentId}` con TTL 90s
    - El dashboard hace ping cada 60s para mantener el status

    En src/api/tenants.js:
    GET /api/tenants/me (adminOnly):
    - Retornar configuración del tenant del admin autenticado
    - Sin datos sensibles (tokens de WhatsApp no exponer completos)

    PATCH /api/tenants/me (adminOnly):
    Body permitido:
    { nombre, prompt_personalizado, horario_inicio, horario_fin,
      modo_bot, telegram_chat_id }
    - NO permitir cambiar whatsapp_number, whatsapp_phone_id (eso es configuración de infraestructura)
    - Invalidar cache Redis del tenant tras actualizar
    - 200 con tenant actualizado

    POST /api/tenants/me/test-bot (adminOnly):
    - Enviar mensaje de prueba al propio número del tenant
    - Útil para verificar que la integración WhatsApp funciona
    - Body: { mensaje: string }
    - Retornar: { enviado: boolean, error?: string }
  </action>
  <verify>
    POST /api/agents con admin JWT → agente creado sin exponer password
    GET /api/agents → lista con status online
    PATCH /api/tenants/me con prompt_personalizado → cache invalidado, nuevo prompt activo
    PATCH /api/agents/:id/status con online:true → status guardado en Redis
  </verify>
  <done>CRUD agentes con roles, gestión de tenant, status online en Redis</done>
</task>

---

## Tareas — Wave 2 (requiere Wave 1)

<task type="auto" id="4-4">
  <n>API REST — Métricas y dashboard KPIs</n>
  <files>
    src/api/dashboard.js
    src/services/metrics.js
  </files>
  <action>
    En src/services/metrics.js:
    Función getDashboardMetrics(tenantId, periodo):
    periodo: 'hoy' | 'semana' | 'mes'

    Calcular con queries Prisma (optimizadas, sin N+1):

    conversaciones_totales: count por período
    conversaciones_bot: count donde resueltas sin handover
    conversaciones_humano: count donde hubo handover
    tasa_resolucion_bot: conversaciones_bot / conversaciones_totales * 100
    mensajes_totales: count mensajes del período
    tiempo_respuesta_promedio: avg(saliente.created_at - entrante.created_at)
      solo primeras respuestas del bot
    cola_actual: count de cola_espera del tenant
    agentes_online: count de Redis keys `agent:online:{id}` del tenant
    conversaciones_activas: count HUMANO + BOT del tenant

    Cache en Redis: 60 segundos (métricas no necesitan ser exactas al segundo)
    Cache key: `metrics:{tenantId}:{periodo}`

    En src/api/dashboard.js:
    GET /api/dashboard/metrics:
    Query: periodo (default 'hoy')
    - Llamar getDashboardMetrics()
    - Retornar métricas completas

    GET /api/dashboard/activity:
    - Últimas 24h de actividad del tenant
    - Array de { hora, mensajes_entrantes, mensajes_salientes }
    - Para gráfico de barras en el dashboard

    GET /api/dashboard/top-intents:
    - Intenciones más frecuentes del período
    - Requiere guardar la intención detectada en el mensaje
    - NOTA: agregar campo intent_detected: String? a tabla mensajes
      en la migración de esta fase

    GET /api/dashboard/realtime:
    - Snapshot del estado actual (sin cache)
    - { conversaciones_activas, cola_actual, agentes_online }
    - Llamado frecuentemente por Socket.io para updates
  </action>
  <verify>
    GET /api/dashboard/metrics?periodo=hoy → objeto con todas las métricas calculadas
    GET /api/dashboard/realtime → snapshot instantáneo sin cache
    Con 10 conversaciones en DB: tasa_resolucion_bot es correcta
  </verify>
  <done>Métricas calculadas con Prisma, cacheadas en Redis, API de dashboard completa</done>
</task>

<task type="auto" id="4-5">
  <n>Migración Prisma — intent_detected y ajustes</n>
  <files>
    prisma/schema.prisma (actualizar)
    prisma/migrations/ (nueva)
    prisma/seed.js (actualizar)
  </files>
  <action>
    Agregar a tabla mensajes:
    - intent_detected: String? (guardar la intención detectada: DISPONIBILIDAD, PRECIOS, etc.)

    Actualizar src/bot/agent.js:
    Al guardar mensaje entrante: incluir intent_detected = resultado de detectIntent

    Agregar a tabla agentes:
    - activo: Boolean, default true (para soft delete)

    Verificar índices importantes:
    - conversaciones: [tenant_id, estado] (ya debería existir)
    - conversaciones: [tenant_id, ultimo_mensaje_at] (para ordenar dashboard)
    - mensajes: [conversacion_id, created_at] (para chat paginado)
    - mensajes: [tenant_id, created_at] (para métricas por período)
    Si alguno falta: agregar en esta migración.

    Ejecutar: npx prisma migrate dev --name add-intent-and-indexes

    Actualizar prisma/seed.js:
    - Agregar 5 conversaciones de prueba con mensajes
    - Incluir variedad: algunas resueltas por bot, otras con handover
    - Incluir intents variados: DISPONIBILIDAD, PRECIOS, SALUDO, DESCONOCIDO
    - Esto permite probar las métricas del dashboard con datos realistas
  </action>
  <verify>
    npx prisma migrate status → todo aplicado
    node prisma/seed.js → 5 conversaciones creadas con mensajes e intents
    GET /api/dashboard/metrics → tasa_resolucion_bot calculada correctamente
  </verify>
  <done>Schema actualizado, índices optimizados, seed con datos de prueba realistas</done>
</task>

---

## Tareas — Wave 3 (cierre)

<task type="auto" id="4-6">
  <n>Montar todas las rutas en Express y test integral</n>
  <files>
    src/index.js (actualizar)
    src/api/router.js
    docs/test-fase4.sh
    docs/api.md
  </files>
  <action>
    Crear src/api/router.js:
    Router central que importa y monta todos los sub-routers:
    - /auth → src/api/auth.js (sin authMiddleware — es el login)
    - /conversations → src/api/conversations.js (con authMiddleware)
    - /agents → src/api/agents.js (con authMiddleware)
    - /tenants → src/api/tenants.js (con authMiddleware)
    - /dashboard → src/api/dashboard.js (con authMiddleware)
    - /queue → src/api/queue.js (con authMiddleware)
    - /handover → src/api/handover.js (con authMiddleware)
    - /telegram → src/api/telegram-webhook.js (sin authMiddleware — usa token propio)

    Actualizar src/index.js:
    - Montar router central en /api
    - Verificar que el orden es correcto:
      1. Middleware de seguridad (helmet, cors)
      2. Rate limiters
      3. Body parser (con raw para /webhook)
      4. Rutas webhook (/webhook)
      5. Rutas API (/api)
      6. 404 handler
      7. Error handler global

    En docs/api.md:
    Documentación Markdown de todos los endpoints:
    - Método, ruta, autenticación requerida
    - Parámetros (body, query, path)
    - Respuesta exitosa (estructura JSON)
    - Códigos de error posibles
    Formato simple y práctico — para que el agente de dashboard en Fase 5 sepa qué consumir.

    En docs/test-fase4.sh:
    Script completo que prueba el flujo de autenticación:
    1. Login → obtener tokens
    2. GET /api/auth/me → verificar datos
    3. GET /api/conversations → lista
    4. GET /api/dashboard/metrics → métricas
    5. GET /api/agents → lista agentes
    6. POST /api/auth/refresh → nuevos tokens
    7. POST /api/auth/logout → 200
    8. GET /api/auth/me con token viejo → 401

    Rebuild y verificación final:
    docker compose build wa-api
    docker compose up -d wa-api
    bash docs/test-fase4.sh
  </action>
  <verify>
    bash docs/test-fase4.sh → todos los pasos pasan
    No hay errores 500 en ningún endpoint
    Rate limiter de login: 6to intento en 1 min → 429
  </verify>
  <done>
    API REST completa funcionando, documentada, todos los endpoints protegidos,
    tests pasando. Commit: feat(fase-4): auth JWT completo, API REST con métricas
  </done>
</task>

---

## Resumen de archivos nuevos en Fase 4

```
src/
├── auth/
│   ├── jwt.js              ← Funciones puras JWT
│   └── service.js          ← Login, refresh, logout con Redis
├── services/
│   └── metrics.js          ← Cálculo de KPIs con cache Redis
└── api/
    ├── router.js            ← Router central
    ├── auth.js              ← Login, refresh, logout, me
    ├── conversations.js     ← CRUD + mensajes manuales
    ├── agents.js            ← CRUD agentes + status online
    ├── tenants.js           ← Config tenant + test-bot
    └── dashboard.js         ← Métricas, actividad, realtime

src/middleware/
└── auth.js (refactor)      ← authMiddleware + adminOnly

docs/
├── api.md                  ← Documentación de todos los endpoints
└── test-fase4.sh

prisma/
└── migrations/ (nueva)     ← intent_detected + índices
```

## Commit esperado

`feat(fase-4): JWT completo con refresh rotation, API REST protegida, métricas dashboard`
