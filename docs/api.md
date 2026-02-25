# Moteland WhatsApp Bot — API Reference

## Base URL
`http://localhost:3001/api`

## Authentication
All protected endpoints require: `Authorization: Bearer {accessToken}`

---

## Auth

### POST /auth/login
Login and get JWT tokens.
- **Rate limit**: 5 attempts/min per IP
- **Body**: `{ "email": "string", "password": "string" }`
- **200**: `{ "accessToken", "refreshToken", "user": { id, email, nombre, rol, tenantId } }`
- **401**: `{ "error": "Credenciales inválidas" }`

### POST /auth/refresh
Rotate tokens (old refresh token is invalidated).
- **Body**: `{ "refreshToken": "string" }`
- **200**: `{ "accessToken", "refreshToken" }`
- **401**: Token expired or revoked

### POST /auth/logout 🔒
Revoke current refresh token.
- **Body**: `{ "refreshToken": "string" }`
- **200**: `{ "success": true }`

### POST /auth/logout-all 🔒
Revoke all sessions for the authenticated agent.
- **200**: `{ "success": true }`

### GET /auth/me 🔒
Get authenticated agent data.
- **200**: `{ id, email, nombre, rol, tenant_id, online, created_at }`

---

## Conversations 🔒

### GET /conversations
List conversations (multi-tenant filtered).
- **Query**: `estado` (BOT|HUMANO|CERRADA|todas), `page`, `limit` (max 100), `search`, `desde` (ISO date)
- **200**: `{ "data": [...], "total": N, "page": N, "totalPages": N }`

### GET /conversations/:id
Conversation detail with last 50 messages.
- **200**: Conversation object with `mensajes`, `agente`, `tenant`

### GET /conversations/:id/messages
Paginated messages for a conversation.
- **Query**: `page`, `limit` (max 100)
- **200**: `{ "data": [...], "total": N, "page": N, "totalPages": N }`

### PATCH /conversations/:id
Update conversation.
- **Body**: `{ "estado"?, "agente_id"?, "contact_name"? }`
- **200**: Updated conversation

### POST /conversations/:id/messages
Send message from dashboard to WhatsApp client.
- **Body**: `{ "contenido": "string" }`
- **201**: Created message object

### DELETE /conversations/:id 🔒👑
Soft-delete (set estado=CERRADA). Admin only.
- **200**: `{ "success": true }`

---

## Agents 🔒

### GET /agents
List agents with online status and active conversation count.

### GET /agents/:id
Agent detail with assigned conversations.

### POST /agents 🔒👑
Create agent. Admin only.
- **Body**: `{ "email", "password", "nombre", "rol"? }`
- **201**: Agent (no password_hash)

### PATCH /agents/:id 🔒👑
Update agent. Admin only.
- **Body**: `{ "nombre"?, "rol"?, "password_nuevo"? }`
- Password change invalidates all sessions.

### DELETE /agents/:id 🔒👑
Delete agent (fails if has active conversations). Admin only.

### PATCH /agents/:id/status 🔒
Update own online status.
- **Body**: `{ "online": boolean }`
- Only the agent themselves can update their status.

---

## Tenant 🔒👑

### GET /tenants/me
Get tenant configuration.

### PATCH /tenants/me
Update tenant settings.
- **Body**: `{ "nombre"?, "prompt_personalizado"?, "horario_inicio"?, "horario_fin"?, "modo_bot"?, "telegram_chat_id"? }`
- Invalidates Redis caches on update.

### POST /tenants/me/test-bot
Send test message to own WhatsApp number.
- **Body**: `{ "mensaje": "string" }`
- **200**: `{ "enviado": boolean, "error"?: "string" }`

---

## Dashboard 🔒

### GET /dashboard/metrics
KPIs for the tenant.
- **Query**: `periodo` (hoy|semana|mes)
- **200**: `{ conversaciones_totales, conversaciones_bot, conversaciones_humano, tasa_resolucion_bot, mensajes_totales, cola_actual, agentes_online, conversaciones_activas, periodo }`

### GET /dashboard/activity
Hourly message activity (last 24h).
- **200**: `[{ "hora": 0-23, "entrantes": N, "salientes": N }]`

### GET /dashboard/realtime
Live snapshot (no cache).
- **200**: `{ conversaciones_activas, cola_actual, agentes_online }`

---

## Queue 🔒

### GET /queue/stats
BullMQ queue counts for all 4 queues.
- **200**: `{ message: {...}, notification: {...}, handover: {...}, deadLetter: {...} }`

---

## Handover 🔒

### GET /handover/active
Active handover conversations.
- **200**: `[{ id, tenant, whatsapp_contact, contact_name, handover_at, tiempo_espera, agente }]`

### POST /handover/:conversacionId/resolve
Resolve a handover.
- **Body**: `{ "resolucion": "bot"|"cerrar" }`
- **200**: `{ success, conversacionId, resolucion }`

---

## Telegram Webhook

### POST /telegram/webhook
Receives updates from Telegram (no JWT — uses secret token header).
- **Header**: `X-Telegram-Bot-Api-Secret-Token`

---

## Legend
- 🔒 Requires `Authorization: Bearer {token}`
- 👑 Requires ADMIN role
