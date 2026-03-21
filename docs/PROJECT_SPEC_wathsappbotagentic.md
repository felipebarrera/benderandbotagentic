# Especificación Técnica y Estado del Proyecto (Moteland B2B Multi-Agente)

## 📌 1. Resumen Ejecutivo
El sistema es una plataforma SaaS B2B "Multi-Tenant" (Multi-Empresa) diseñada para proveer un bot de Inteligencia Artificial (basado en OpenAI GPT-4o-mini) conectado a WhatsApp Cloud API. Cada empresa que se registra en la plataforma obtiene su propio número de recepción, bots configurables con personalidad a medida, y la capacidad de entregar respuestas automatizadas o transferir la conversación ("Handover") a un agente humano a través de un Dashboard en tiempo real, e integrándose vía Webhook a plataformas externas (ej. PMS de hoteles u otros).

---

## 🏗️ 2. Arquitectura de Software y Stack Tecnológico

El proyecto está diseñado bajo una arquitectura de microservicios contenerizada:
- **Backend API (`wa-api`)**: Node.js (ESM), Express.js.
- **Base de Datos**: PostgreSQL 16 (gestionada vía ORM Prisma).
- **Caché y Mensajería**: Redis 7.
- **Procesamiento de Colas**: BullMQ (para asegurar que los mensajes de WhatsApp no se pierdan bajo alta concurrencia).
- **Frontend Panel (`dashboard`)**: React.js (Vite), React Router, context API, Vanilla CSS (diseño Glassmorphism).
- **Tiempo Real**: WebSockets usando `Socket.io` con autenticación JWT integrada.
- **Proxy Inverso**: Nginx (gestiona los puertos 80/443, ruteo del dashboard SPA, API y WebSockets).

---

## ⚙️ 3. ¿Cómo Funciona el Flujo Principal?

1. **Recepción de Mensajes (Webhook)**: Cuando un cliente final envía un WhatsApp, Meta golpea el endpoint `/webhook` de nuestro Nginx, que lo envía al servicio Node.js.
2. **Identificación del Tenant (Multi-Tenancy)**: El servidor extrae el `whatsapp_phone_id` e identifica a qué empresa pertenece el mensaje (Tenant A, B, o C). Todo el flujo de datos ocurre aislado bajo el identificador de este Tenant.
3. **Bot IA Engine**:
   - Se consulta el historial de conversación en PostgreSQL.
   - El mensaje se procesa por un clasificador de intenciones (ej. `SALUDO`, `RESERVA`, `DESCONOCIDO`).
   - El motor de llm construye en contexto y envía la respuesta GPT a WhatsApp.
4. **Handover (Traspaso Humano)**: Si GPT no sabe responder o detecta intención `DESCONOCIDO`, pausa el bot (`estado: HUMANO`) y envía una alerta vía Telegram al administrador del Tenant.
5. **Dashboard en Tiempo Real**: Socket.io emite el evento al navegador del administrador de la empresa. El admin ve llegar el mensaje en la pantalla de "Conversaciones", pulsa "Tomar Control Manual", y responde él mismo (en ese momento, la API hace el envío mediante WhatsApp Cloud en su nombre).

---

## 🐳 4. Estado de Docker y Entorno de Producción

Actualmente, el ambiente de producción (`docker-compose.prod.yml`) **está levantado y funcionando**. La arquitectura es robusta y segura:

### Servicios Docker Activos:
- `moteland_postgres`: Expone el puerto 5432 **solo internamente** hacia la red de Docker (seguridad alta).
- `moteland_redis`: Expone 6379 **solo internamente**.
- `moteland_api`: Escucha en el 3001 interno y procesa toda la lógica.
- `moteland_dashboard`: Contenedor Nginx estático hiper-ligero sirviendo el front-end React en el puerto 80 interno.
- `moteland_proxy`: Nginx público que enruta:
  - `/api` y `/socket.io` hacia `moteland_api`.
  - `/` (todo lo demás) hacia `moteland_dashboard`.

**(Para acceder al sistema actual en tu máquina:** Visita `http://localhost` en el navegador).

---

## 🛡️ 5. Funcionalidad de Super Admin

Se introdujo el rol jerárquico máximo **SUPERADMIN**, con su propio Tenant ("Moteland System").
- **¿Qué logra?**: Permite acceder al panel en la ruta `/superadmin` viendo a todas las empresas cliente del servidor.
- **Capacidades**: Ver estadísticas agregadas (total de agentes, conversaciones) y **Suspender/Activar** a una empresa (Tenant) con un botón, bloqueando instantáneamente la funcionalidad de los bots para empresas morosas o desactivadas.

---

## ✅ 6. Hitos Completados frente a Milestone Inicial

El **Milestone 1 — MVP Producción** está 100% completado. Corresponde al desarrollo de las 6 Fases planeadas:
1. **Fase 1 (Webhook)**: Recepción de WhatsApp OK. Criptografía verificada.
2. **Fase 2 (Bot IA)**: Integración GPT-4o y PMS Legacy OK.
3. **Fase 3 (Handover)**: Worker externo con BullMQ listo. Handover y Telegram Bots funcionales.
4. **Fase 4 (API REST)**: JWT Authentication, CRUD de Config y Agentes listos.
5. **Fase 5 (Dashboard)**: Front-end SPA en React con Socket.io en vivo OK. (Re-Branding B2B a Empresas aplicado).
6. **Fase 6 (Aislamiento y Deploy)**: Arquitectura multi-tenant verificada sin fuga de datos, Runbook de producción y CLI para crear Tenants listos.

---

## 🚀 Siguientes Pasos Operativos

El código se encuentra en estado **Listo para Producción** (Production-Ready).
Las siguientes acciones dependen puramente del negocio:
1. Conseguir el primer Meta Business Account aprobado (Tenant "0", tu propia empresa de pruebas en WhatsApp).
2. Levantar esto en el VPS en internet usando el script `./scripts/deploy.sh` y provisionando Let's Encrypt (Certificados TLS que ya soportamos vía Nginx).
3. Añadir a los primeros clientes usando el script CLI: `node scripts/onboard-tenant.js`.
