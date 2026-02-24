# 📜 Constitution — Moteland WhatsApp Multiagente

> Este documento es la ley. Todo agente que trabaje en este proyecto
> DEBE leerlo antes de escribir una sola línea de código.
> En caso de conflicto, la Constitution gana siempre.

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Node.js | 20 LTS |
| API | Express | 5.x |
| Frontend | React + Vite | 19.x |
| Cola | BullMQ | latest |
| Cache/Cola | Redis | 7 Alpine |
| Base de datos | PostgreSQL | 16 Alpine |
| ORM | Prisma | latest |
| WebSocket | Socket.io | latest |
| IA intención | OpenAI | GPT-4o-mini |
| WhatsApp | Meta Cloud API | v18.0 |
| Contenedores | Docker Compose | v3.9 |
| Proxy | Nginx | 1.25 Alpine |

---

## 🚫 Patrones Prohibidos — NUNCA hacer esto

### JavaScript
- ❌ `var` — usar solo `const` y `let`
- ❌ `console.log` — usar siempre `logger.info/error/warn` (Winston)
- ❌ Callbacks — usar siempre `async/await`
- ❌ `.then().catch()` encadenado — usar `try/catch` con `await`
- ❌ `require()` mezclado con `import` — elegir uno y ser consistente (ESM preferido)
- ❌ Hardcodear credenciales, URLs, tokens en código fuente
- ❌ `process.exit()` sin logging previo del error

### Base de datos
- ❌ SQL raw sin Prisma (salvo migraciones justificadas)
- ❌ Queries sin `tenant_id` — TODA tabla tiene tenant_id
- ❌ Borrado físico — usar `deleted_at` (soft delete)
- ❌ `SELECT *` — siempre seleccionar campos explícitos

### Docker / Infra
- ❌ Modificar `/home/master/Documentos/sitiosweb/docker/src/motelmultiempresa/` — es la app legacy, es READ-ONLY
- ❌ Exponer PostgreSQL o Redis al exterior (solo red interna Docker)
- ❌ Correr contenedores como root
- ❌ Credenciales en Dockerfiles o docker-compose.yml — usar `.env`

### API
- ❌ Endpoints sin autenticación JWT (excepto `/webhook` y `/health`)
- ❌ Responder stacks de error al cliente en producción
- ❌ Rate limiting ausente en endpoints públicos

---

## ✅ Patrones Obligatorios

### Estructura de archivos
```
src/
├── config/index.js      # Valida TODAS las env vars al arrancar
├── middleware/
│   ├── auth.js          # Verifica JWT en cada request privado
│   ├── tenant.js        # Resuelve tenant_id desde número WhatsApp
│   └── rateLimit.js     # Rate limiting con Redis
├── bot/                 # Lógica del agente WhatsApp
├── queue/               # BullMQ jobs y workers
├── api/                 # Rutas Express organizadas por dominio
├── db/prisma.js         # Singleton Prisma client
└── socket/index.js      # Socket.io server
```

### Logging
```javascript
// ✅ Correcto
import { logger } from '../config/logger.js'
logger.info('Mensaje recibido', { tenantId, from, messageId })
logger.error('Error procesando webhook', { error: err.message, stack: err.stack })

// ❌ Incorrecto
console.log('Mensaje recibido')
```

### Manejo de errores
```javascript
// ✅ Correcto
async function processMessage(data) {
  try {
    const result = await someOperation(data)
    return result
  } catch (err) {
    logger.error('processMessage failed', { error: err.message, data })
    throw err  // re-lanzar para que BullMQ reintente
  }
}
```

### Variables de entorno
```javascript
// ✅ En src/config/index.js — validar todo al arrancar
const required = ['DATABASE_URL', 'REDIS_URL', 'WHATSAPP_TOKEN', 'OPENAI_API_KEY']
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}
```

### Commits
```
feat(webhook): agregar verificación HMAC firma Meta
fix(queue): corregir retry logic en worker BullMQ
chore(docker): actualizar nginx conf para WebSocket
docs(api): documentar endpoints de conversaciones
```

---

## 🏢 Multi-Tenancy — Regla Absoluta

**CADA modelo de base de datos tiene `tenant_id`. Sin excepción.**

```sql
-- ✅ Correcto
SELECT id, nombre, estado FROM conversaciones WHERE tenant_id = $1 AND id = $2

-- ❌ NUNCA — expone datos de otros tenants
SELECT id, nombre, estado FROM conversaciones WHERE id = $1
```

El `tenant_id` se resuelve en el middleware `tenant.js` usando el número de WhatsApp receptor del webhook. Una vez resuelto, se propaga en `req.tenantId` a todos los handlers.

---

## 📱 App Legacy — Protocolo de Integración

**La app Moteland PMS es READ-ONLY para nosotros.**

- Ruta en disco: `/home/master/Documentos/sitiosweb/docker/src/motelmultiempresa/`
- URL interna Docker: `http://motelmulti:3000`
- Autenticación: header `X-Internal-Secret: ${INTERNAL_API_SECRET}`

### Endpoints disponibles del PMS
```
GET  /api/habitaciones/disponibles?fecha=YYYY-MM-DD&personas=N
GET  /api/habitaciones/precios
GET  /api/reservas/tenant/:tenantId
POST /api/reservas/simple   (body: tenantId, fecha, personas, contacto)
GET  /health
```

### Cómo consumirlos
```javascript
// ✅ Usar el cliente centralizado
import { motelandClient } from '../moteland/client.js'
const disponibilidad = await motelandClient.getDisponibilidad(fecha, personas)
```

**NUNCA hacer fetch directo a motelmulti desde otros módulos.**
Todo pasa por `src/moteland/client.js`.

---

## 🔌 Servicios Docker — Red Interna

| Servicio | Host interno | Puerto |
|---------|-------------|--------|
| PMS Legacy | `motelmulti` | `3000` |
| WhatsApp API | `wa-api` | `3001` |
| Dashboard | `wa-dashboard` | `80` |
| PostgreSQL | `postgres` | `5432` |
| Redis | `redis` | `6379` |

La red se llama `moteland_net`. Todos los servicios se comunican por nombre de host, nunca por IP.

---

## 🤖 WhatsApp Bot — Flujo de Estados

```
MENSAJE ENTRANTE
      │
      ▼
  ¿tenant activo?
      │
   sí │           no → ignorar
      ▼
  ¿modo bot o humano?
      │
   bot│          humano → reenviar al agente asignado
      ▼
  WhatsAppAgent.process(msg)
      │
      ├── detectar intención (GPT-4o-mini)
      │         │
      │    disponibilidad → consultarPMS() → responder
      │    precios        → consultarPMS() → responder
      │    reserva        → crearReserva() → confirmar
      │    saludo         → responderSaludo()
      │    desconocido    → handoverHumano()
      │
      └── guardar en DB + emit socket.io
```

---

## 📊 Métricas KPI — Dashboard

El dashboard muestra en tiempo real vía Socket.io:
- Conversaciones activas por tenant
- Cola de espera (cantidad + tiempo promedio)
- Agentes online/offline
- Tasa de resolución bot vs humano
- Tiempo promedio de respuesta

---

## 🔒 Seguridad

- JWT access token: 15 minutos
- JWT refresh token: 7 días, rotación en cada uso
- Webhook Meta: verificar firma HMAC-SHA256 con `WHATSAPP_APP_SECRET`
- Rate limiting: 30 req/min webhook, 100 req/min API, usando Redis
- CORS: solo dominios explícitos en producción
- Sanitización: nunca interpolar input de usuario en queries

---

## 📁 Estructura de directorios del proyecto

```
whatsappbotagentic/
├── .agent/workflows/        ← Antigravity workflows (spec-kit)
├── .planning/               ← GSD state
├── memory/                  ← Este archivo + otros de contexto
├── templates/               ← Templates spec-kit
├── src/                     ← Código fuente API + Worker
│   ├── config/
│   ├── bot/
│   ├── queue/
│   ├── api/
│   ├── moteland/
│   ├── db/
│   ├── socket/
│   └── middleware/
├── worker/                  ← Entry point BullMQ worker
├── dashboard/               ← React app
│   └── src/
├── prisma/
│   └── schema.prisma
├── Dockerfile.api
├── Dockerfile.worker
├── Dockerfile.dashboard
└── AGENTS.md
```
