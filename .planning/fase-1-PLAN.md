# Fase 1 — Fundación y Webhook
# PLAN completo para /gsd:execute-phase 1 → Antigravity /execute

## Contexto de la fase

Crear la base del proyecto: servidor Express arrancando, base de datos con schema completo,
webhook de WhatsApp funcionando y verificado. Sin bot todavía — solo recibir y persistir mensajes.

## Señal de éxito

```bash
curl http://localhost:3001/health
# → {"status":"ok","db":"connected","redis":"connected","version":"1.0.0"}
```

Y en PostgreSQL existe la tabla `mensajes` con el primer mensaje de prueba guardado.

---

## Tareas — Wave 1 (paralelas, independientes)

<task type="auto" id="1-1">
  <n>Inicializar proyecto Node.js con ESM y dependencias</n>
  <files>
    package.json
    .env.example
    .gitignore
    src/config/index.js
    src/config/logger.js
  </files>
  <action>
    Crear package.json con type:"module" (ESM puro).
    Dependencias principales: express@^5, @prisma/client, bullmq, ioredis, openai,
    winston, dotenv, jsonwebtoken, bcryptjs, cors, helmet, express-rate-limit,
    socket.io, node-fetch.
    Dependencias dev: prisma, nodemon.

    En src/config/index.js:
    - Importar dotenv y llamar config() al inicio
    - Validar que estas env vars existen, si falta alguna throw Error con nombre claro:
      DATABASE_URL, REDIS_URL, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID,
      WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, OPENAI_API_KEY,
      INTERNAL_API_SECRET, JWT_SECRET, JWT_REFRESH_SECRET
    - Exportar objeto config con todos los valores tipados

    En src/config/logger.js:
    - Winston con transports: Console (dev) + File (producción)
    - Formato: timestamp + level + message + metadata JSON
    - Niveles: error, warn, info, debug
    - Exportar logger como default
  </action>
  <verify>node src/config/index.js no lanza errores con vars completas</verify>
  <done>package.json existe con type:module, config valida env vars, logger funciona</done>
</task>

<task type="auto" id="1-2">
  <n>Schema Prisma completo multi-tenant</n>
  <files>
    prisma/schema.prisma
  </files>
  <action>
    Crear schema Prisma con provider postgresql y las siguientes tablas:

    TENANTS (un registro por motel/negocio):
    - id: uuid, pk, default uuid
    - nombre: String
    - whatsapp_number: String, unique (ej: "+56912345678")
    - whatsapp_phone_id: String (ID del número en Meta)
    - modo_bot: Boolean, default true
    - prompt_personalizado: String? (nullable)
    - horario_inicio: String, default "00:00"
    - horario_fin: String, default "23:59"
    - activo: Boolean, default true
    - created_at: DateTime, default now()
    - updated_at: DateTime, updatedAt

    AGENTES (usuarios del dashboard):
    - id: uuid, pk
    - tenant_id: uuid, FK → tenants
    - email: String, unique
    - password_hash: String
    - nombre: String
    - rol: Enum {ADMIN, AGENTE}
    - online: Boolean, default false
    - ultimo_ping: DateTime?
    - created_at, updated_at

    CONVERSACIONES:
    - id: uuid, pk
    - tenant_id: uuid, FK → tenants
    - whatsapp_contact: String (número del cliente)
    - contact_name: String?
    - estado: Enum {BOT, HUMANO, CERRADA}
    - agente_id: uuid?, FK → agentes (nullable)
    - ultimo_mensaje_at: DateTime
    - created_at, updated_at
    - Index: [tenant_id, estado]

    MENSAJES:
    - id: uuid, pk
    - conversacion_id: uuid, FK → conversaciones
    - tenant_id: uuid (desnormalizado para queries rápidas)
    - whatsapp_message_id: String, unique (ID de Meta)
    - direccion: Enum {ENTRANTE, SALIENTE}
    - tipo: Enum {TEXTO, AUDIO, IMAGEN, SISTEMA}
    - contenido: String
    - procesado: Boolean, default false
    - created_at: DateTime

    COLA_ESPERA:
    - id: uuid, pk
    - tenant_id: uuid
    - conversacion_id: uuid, FK → conversaciones
    - prioridad: Int, default 0
    - created_at: DateTime

    Relaciones:
    - tenants → agentes (1:N)
    - tenants → conversaciones (1:N)
    - conversaciones → mensajes (1:N)
    - agentes → conversaciones (1:N, nullable)
  </action>
  <verify>npx prisma validate pasa sin errores</verify>
  <done>schema.prisma válido con todas las tablas y relaciones</done>
</task>

---

## Tareas — Wave 2 (después de Wave 1)

<task type="auto" id="1-3">
  <n>Prisma client singleton y migración inicial</n>
  <files>
    src/db/prisma.js
    prisma/migrations/ (generado)
  </files>
  <action>
    En src/db/prisma.js:
    - Crear singleton PrismaClient para evitar múltiples conexiones en dev
    - Pattern estándar: global.__prisma || new PrismaClient({log: ['error', 'warn']})
    - Exportar como default

    Ejecutar:
    npx prisma migrate dev --name init

    Verificar que las tablas existen en PostgreSQL del contenedor.
  </action>
  <verify>npx prisma studio muestra las tablas (o query directo al contenedor)</verify>
  <done>src/db/prisma.js exporta client singleton, migración aplicada en DB</done>
</task>

<task type="auto" id="1-4">
  <n>Servidor Express con middleware base</n>
  <files>
    src/index.js
    src/middleware/errorHandler.js
    src/middleware/rateLimit.js
  </files>
  <action>
    En src/index.js:
    - Importar config PRIMERO (valida env vars)
    - Importar logger
    - Crear app Express 5
    - Middleware en orden: helmet(), cors(orígenes explícitos), express.json(limit:'10mb')
    - Montar rutas: /health, /webhook, /api
    - Error handler global al final
    - Iniciar servidor en PORT (default 3001)
    - Loggear "🚀 Moteland WA API corriendo en puerto X" al arrancar
    - Graceful shutdown: SIGTERM → cerrar DB → cerrar servidor

    En src/middleware/errorHandler.js:
    - Capturar errores de Express 5
    - En producción: solo {error: "Internal server error", code: err.code}
    - En dev: incluir stack
    - Siempre loggear con logger.error

    En src/middleware/rateLimit.js:
    - Rate limiter con redis store
    - webhookLimiter: 30 req/min
    - apiLimiter: 100 req/min
    - Respuesta 429 con mensaje claro
  </action>
  <verify>curl http://localhost:3001/health → 200 antes de montar rutas de webhook</verify>
  <done>Servidor arranca, middleware activo, graceful shutdown funciona</done>
</task>

---

## Tareas — Wave 3 (después de Wave 2)

<task type="auto" id="1-5">
  <n>Health check endpoint</n>
  <files>
    src/api/health.js
  </files>
  <action>
    GET /health:
    - Verificar conexión DB: prisma.$queryRaw`SELECT 1`
    - Verificar Redis: redis.ping()
    - Responder JSON:
      {
        status: "ok" | "degraded",
        db: "connected" | "error",
        redis: "connected" | "error",
        version: package.json version,
        uptime: process.uptime()
      }
    - Status 200 si todo ok, 503 si alguno falla
    - Sin autenticación — público
    - Sin rate limit — es el health check

    Importar Redis client de src/db/redis.js:
    - Crear src/db/redis.js con ioredis singleton
    - Config desde REDIS_URL env var
    - On error: logger.error pero no crash el proceso
  </action>
  <verify>curl http://localhost:3001/health → {"status":"ok","db":"connected","redis":"connected"}</verify>
  <done>Health check responde correctamente con estado real de servicios</done>
</task>

<task type="auto" id="1-6">
  <n>Webhook WhatsApp — verificación y recepción</n>
  <files>
    src/webhook/router.js
    src/webhook/verify.js
    src/webhook/processor.js
    src/middleware/tenant.js
  </files>
  <action>
    En src/webhook/verify.js:
    - Función verifyHMAC(payload, signature, secret):
      usar crypto.createHmac('sha256', secret).update(payload).digest('hex')
      comparar con header x-hub-signature-256 (quitar 'sha256=')
      usar crypto.timingSafeEqual para evitar timing attacks
      retornar boolean

    En src/middleware/tenant.js:
    - Extraer número receptor del payload WhatsApp: body.entry[0].changes[0].value.metadata.display_phone_number
    - Buscar tenant en DB por whatsapp_number
    - Si no existe: logger.warn + next() sin tenant (webhook verification pasa igual)
    - Si existe: req.tenant = tenant, req.tenantId = tenant.id
    - Cachear en Redis por 5 minutos para no ir a DB en cada mensaje

    En src/webhook/router.js:
    - GET /webhook/whatsapp: verificar mode='subscribe', token=WHATSAPP_VERIFY_TOKEN, responder challenge
    - POST /webhook/whatsapp:
      1. Verificar HMAC con raw body (IMPORTANTE: usar express.raw() antes de json() para esta ruta)
      2. Si falla HMAC: 403
      3. Parsear payload
      4. Resolver tenant
      5. Encolar cada mensaje en BullMQ queue 'message-processing'
      6. Responder 200 INMEDIATAMENTE (Meta requiere < 5s o reintenta)

    En src/webhook/processor.js:
    - Función extractMessages(payload): extraer array de mensajes del payload Meta
    - Función saveMessage(msg, tenant): guardar en DB
      - Buscar o crear conversacion por whatsapp_contact
      - Crear mensaje en tabla mensajes
      - Actualizar ultimo_mensaje_at en conversacion
  </action>
  <verify>
    Test GET: curl "http://localhost:3001/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=123" → "123"
    Test POST: enviar payload simulado de Meta → mensaje guardado en DB
  </verify>
  <done>Webhook verifica firma, responde challenge, guarda mensajes en DB y responde 200 en < 100ms</done>
</task>

---

## Tareas — Wave 4 (cierre de fase)

<task type="auto" id="1-7">
  <n>Dockerfile.api y verificación Docker completa</n>
  <files>
    Dockerfile.api
    .dockerignore
  </files>
  <action>
    Ajustar Dockerfile.api existente si hay cambios necesarios por las dependencias instaladas.

    .dockerignore debe incluir:
    node_modules, .env, .env.*, *.log, .git, prisma/migrations (se ejecutan en deploy)

    Verificar build completo:
    docker compose build wa-api
    docker compose up -d wa-api
    docker compose logs wa-api (verificar que arranca sin errores)
    curl http://localhost:3001/health

    Si hay error de Prisma en Docker: asegurarse que el Dockerfile corre
    `npx prisma generate` antes del CMD final.
  </action>
  <verify>docker compose up -d wa-api && curl http://localhost:3001/health → {"status":"ok"}</verify>
  <done>Imagen Docker construye y corre correctamente, health check verde desde contenedor</done>
</task>

<task type="auto" id="1-8">
  <n>Seed de datos iniciales y test end-to-end</n>
  <files>
    prisma/seed.js
    docs/test-webhook.sh
  </files>
  <action>
    En prisma/seed.js:
    - Crear tenant de prueba:
      nombre: "Motel Test", whatsapp_number: "+56900000001",
      whatsapp_phone_id: "TEST_PHONE_ID", modo_bot: true
    - Crear agente admin:
      email: "admin@test.cl", password: bcrypt("admin123"), rol: ADMIN

    En docs/test-webhook.sh:
    - Script bash que simula payload real de Meta
    - Incluir header x-hub-signature-256 calculado correctamente
    - Verificar que el mensaje queda en DB

    Agregar a package.json:
    "scripts": {
      "dev": "nodemon src/index.js",
      "start": "node src/index.js",
      "db:migrate": "prisma migrate deploy",
      "db:seed": "node prisma/seed.js",
      "db:studio": "prisma studio"
    }
  </action>
  <verify>
    node prisma/seed.js → sin errores
    bash docs/test-webhook.sh → respuesta 200
    Consultar DB: SELECT * FROM mensajes LIMIT 5 → registro existe
  </verify>
  <done>Seed crea datos de prueba, test script verifica flujo completo end-to-end</done>
</task>

---

## Resumen de archivos de la Fase 1

```
src/
├── index.js
├── config/
│   ├── index.js
│   └── logger.js
├── db/
│   ├── prisma.js
│   └── redis.js
├── middleware/
│   ├── errorHandler.js
│   ├── rateLimit.js
│   └── tenant.js
├── webhook/
│   ├── router.js
│   ├── verify.js
│   └── processor.js
└── api/
    └── health.js
prisma/
├── schema.prisma
└── seed.js
docs/
└── test-webhook.sh
Dockerfile.api (ajustado)
.dockerignore
package.json
.env.example (actualizado)
```

## Commit esperado al finalizar

`feat(fase-1): fundación completa — webhook WhatsApp funcionando con DB y Docker`
