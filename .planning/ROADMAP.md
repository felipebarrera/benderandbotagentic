# ROADMAP.md — Moteland WhatsApp Multiagente

## Milestone 1: MVP Producción (3 semanas)

---

### Fase 1 — Fundación y Webhook ✦ [2-3 días]

**Objetivo**: El servidor arranca, recibe mensajes de WhatsApp y los guarda en la DB.

Entregables:
- Proyecto Node.js inicializado con ESM, Express 5, Prisma, Winston
- Schema PostgreSQL completo (tenants, conversaciones, mensajes, agentes, cola)
- Migraciones Prisma ejecutadas
- Endpoint GET /webhook (verificación Meta)
- Endpoint POST /webhook (recepción mensajes)
- Verificación HMAC-SHA256 de firma Meta
- Middleware tenant resolver
- Configuración env vars validada al arrancar
- Health check en /health
- Dockerfile.api funcional
- Tests: webhook recibe y guarda mensaje correctamente

**Señal de éxito**: `curl localhost:3001/health` → `{"status":"ok","db":"connected","redis":"connected"}`

---

### Fase 2 — Bot IA + Integración PMS ✦ [3-4 días]

**Objetivo**: El bot responde mensajes reales con información real del PMS.

Entregables:
- Cliente HTTP para PMS legacy (`src/moteland/client.js`)
- WhatsAppAgent class con loop detect → respond
- Detección de intención con GPT-4o-mini (disponibilidad/precios/reserva/saludo/desconocido)
- Handlers por intención conectados al PMS real
- Envío de mensajes de vuelta via WhatsApp Cloud API
- Prompts personalizables por tenant en DB
- Modo bot activo/inactivo por tenant
- Tests: bot responde "disponibilidad" con datos reales del PMS

**Señal de éxito**: Enviar "hola tienen habitaciones para mañana?" → bot responde con disponibilidad real en < 3s

---

### Fase 3 — Cola, Handover y Notificaciones ✦ [2-3 días]

**Objetivo**: Nunca se pierde un mensaje. El dueño recibe alerta y puede tomar control.

Entregables:
- BullMQ configurado con Redis (cola `message-processing`)
- Worker separado (Dockerfile.worker) procesando jobs
- Retry automático 3x con backoff exponencial
- Dead letter queue para fallidos
- Handover trigger automático (intención=desconocido)
- Comandos: /tomar, /bot, /cerrar desde Telegram/WhatsApp del dueño
- Notificación Telegram al dueño cuando hay handover (via Nanobot skill)
- Timeout 5 min: si dueño no responde → bot retoma
- Dockerfile.worker funcional

**Señal de éxito**: Enviar mensaje desconocido → dueño recibe alerta Telegram → dueño responde → respuesta llega al cliente

---

### Fase 4 — Autenticación y API REST ✦ [2 días]

**Objetivo**: Sistema de login seguro y API completa para el dashboard.

Entregables:
- JWT auth (access 15min + refresh 7días con rotación)
- Endpoints: POST /auth/login, POST /auth/refresh, POST /auth/logout
- CRUD /api/conversations (list, get, update estado)
- CRUD /api/agents (list, create, update, delete)
- GET /api/queue (estado cola actual)
- GET /api/dashboard/metrics (KPIs en tiempo real)
- PUT /api/config/tenant (actualizar config del tenant)
- Rate limiting Redis en todos los endpoints
- Middleware auth en rutas privadas

**Señal de éxito**: Login con credenciales → JWT válido → GET /api/conversations devuelve lista correcta

---

### Fase 5 — Dashboard React en Tiempo Real ✦ [3 días]

**Objetivo**: El dueño ve todo lo que pasa en su negocio en tiempo real.

Entregables:
- Socket.io server emitiendo eventos: new_message, conversation_update, agent_status, queue_update
- React app con Vite (sin TypeScript en v1 — velocidad sobre pureza)
- Páginas: Login, Dashboard (KPIs), Conversaciones (lista + chat), Cola, Agentes
- Hook useSocket.js para reconexión automática
- Conversaciones actualizan en < 1 segundo sin reload
- Indicador visual bot🤖/humano👤 por conversación
- Dockerfile.dashboard funcional (Nginx SPA)
- Nginx configurado para WebSocket upgrade

**Señal de éxito**: Abrir dashboard → enviar WhatsApp → ver mensaje aparecer en tiempo real sin recargar página

---

### Fase 6 — Multi-Tenant Completo y Deploy Final ✦ [2 días]

**Objetivo**: 3 clientes reales corriendo en producción sin interferirse.

Entregables:
- Script de onboarding de nuevo tenant (crea registro, genera credenciales)
- Aislamiento verificado: datos de Tenant A nunca visibles para Tenant B
- Configuración Nginx con SSL (dominios de producción)
- Variables de entorno de producción configuradas
- Los 3 primeros tenants creados: 2 moteles + 1 repuestos
- Monitoring básico: health checks cada 5 min via Nanobot
- Runbook de deploy documentado en `docs/deploy.md`

**Señal de éxito**: 3 números de WhatsApp distintos funcionando simultáneamente, datos aislados, dashboard por tenant

---

## Estado actual

| Fase | Estado | Inicio | Fin estimado |
|------|--------|--------|--------------|
| Fase 1 | ⏳ Pendiente | - | - |
| Fase 2 | ⏳ Pendiente | - | - |
| Fase 3 | ⏳ Pendiente | - | - |
| Fase 4 | ⏳ Pendiente | - | - |
| Fase 5 | ⏳ Pendiente | - | - |
| Fase 6 | ⏳ Pendiente | - | - |
