# REQUIREMENTS.md — Moteland WhatsApp Multiagente

## V1 — MVP (estas 3 semanas)

### REQ-01: Webhook WhatsApp
- Recibir mensajes de Meta Cloud API via POST /webhook/whatsapp
- Verificar firma HMAC-SHA256 con APP_SECRET
- Responder verificación GET (challenge) de Meta
- Procesar: texto, audio (transcribir), imágenes (ignorar en v1)

### REQ-02: Bot IA
- Detectar intención del mensaje con GPT-4o-mini
- Intenciones v1: disponibilidad, precios, reserva simple, saludo, despedida, desconocido
- Consultar PMS Moteland para disponibilidad y precios reales
- Responder en < 3 segundos
- Tono: amable, conciso, como atiende un humano chileno

### REQ-03: Handover a humano
- Si intención = desconocido → transferir a humano automáticamente
- Si dueño escribe `/tomar` → tomar control de la conversación
- Si dueño escribe `/bot` → devolver control al bot
- Notificar al dueño por Telegram cuando hay handover
- Timeout: si dueño no responde en 5 min → bot retoma

### REQ-04: Cola con retry
- BullMQ procesa mensajes en cola
- Retry automático 3 veces con backoff exponencial
- Dead letter queue para mensajes fallidos
- No perder ningún mensaje aunque la API de OpenAI falle

### REQ-05: Multi-tenancy
- Cada número de WhatsApp = un tenant
- Datos completamente aislados por tenant_id en PostgreSQL
- Configuración por tenant: nombre, horario atención, prompt personalizado

### REQ-06: Autenticación dashboard
- JWT access (15 min) + refresh (7 días)
- Login con email/password
- Cada agente pertenece a un tenant

### REQ-07: Dashboard básico
- Lista de conversaciones activas (tiempo real via Socket.io)
- Indicador bot/humano por conversación
- Cola de espera con contador
- Agentes online/offline

### REQ-08: API REST
- CRUD conversaciones, agentes, configuración tenant
- Protegida con JWT
- Rate limiting con Redis

---

## V2 — Siguiente milestone (no construir ahora)

- Bridge Twilio para que agentes respondan desde WhatsApp personal
- Reportes y métricas históricas
- Campañas masivas (broadcast)
- Integración Bsale contabilidad
- App móvil para agentes

---

## Out of scope SIEMPRE

- Modificar la app legacy Moteland PMS
- Soporte para canales distintos a WhatsApp
- Funcionalidades de pago/facturación (eso va en sistema separado)
