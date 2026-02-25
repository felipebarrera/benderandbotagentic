# Fase 5 — Dashboard React en Tiempo Real
# PLAN COMPLETO

## Objetivo
El dueño ve todo lo que pasa en su negocio en tiempo real. Construiremos una aplicación React (Vite) conectada al backend vía API REST y WebSockets (Socket.io).

## Arquitectura y Diseño
- **Frontend**: React (Vite), React Router DOM, Axios, Socket.io-client.
- **Estilos**: Vanilla CSS con diseño extremadamente premium, responsive, modo oscuro/claro, animaciones fluidas, UI moderna estilo "glassmorphism".
- **Backend API**: Añadir Socket.io al servidor Express (`src/index.js`) y emitir eventos cuando haya cambios en DB.
- **Infraestructura**: Carpeta `dashboard/` con su propio `Dockerfile.dashboard` (construido con Nginx).

---

## Tareas — Wave 1: Backend Socket.io
1. **Instalar `socket.io`** en el backend.
2. **Configurar Socket.io** en `src/index.js` y `src/socket/index.js`.
   - Autenticación usando el JWT (middleware de socket.io).
   - Unirse a "rooms" por `tenantId` para aislar eventos.
3. **Emitir eventos**:
   - `new_message`: En `webhook/processor.js` y agent.
   - `conversation_update`: Al hacer handover o cambiar estado.
   - `queue_update`: Al encolar/desencolar.
   - `metrics_update`: Emitir métricas actualizadas cada 10s o cuando cambien.

## Tareas — Wave 2: Frontend Setup y Diseño Base
1. Inicializar app Vite (`npm create vite@latest dashboard -- --template react`).
2. Configurar estructura (`src/pages`, `src/components`, `src/services`, `src/hooks`).
3. Definir **Design System en Vanilla CSS** (`variables.css`, `index.css`).
   - Colores premium, tipografía moderna (Inter/Outfit).
4. Implementar Auth Provider y Axios interceptor para refrescar tokens automáticamente.
5. Crear `useSocket.js` hook para manejar la conexión WebSocket.

## Tareas — Wave 3: Vistas del Dashboard
1. **Página de Login**: Diseño glassmorphism atractivo.
2. **Layout Principal**: Sidebar con navegación (Métricas, Conversaciones, Agentes, Configuración).
3. **Página de Métricas (Dashboard)**: Tarjetas de estadísticas (KPIs), gráfico de actividad.
4. **Página de Conversaciones**:
   - Lista a la izquierda con indicador 🤖/👤 y timestamps.
   - Chat a la derecha, con scroll automático, globitos de mensaje.
   - Botón para "Tomar control" (Handover manual) y "Cerrar".
   - Input para enviar mensajes manuakes al cliente de WhatsApp.
5. **Página de Agentes y Roles**: Crear agentes, ver status online en tiempo real.

## Tareas — Wave 4: Integración Docker
1. Escribir `Dockerfile.dashboard` (Build con Node, serve con Nginx).
2. Modificar `docker-compose.yml` para levantar el frontend en el puerto 80 (o mapearlo localmente al 3000).
3. Configurar proxy Nginx para redirigir API y WebSockets adecuadamente al contenedor back-end.

## Señal de éxito
Al hacer validación, el frontend compila via Docker, podemos iniciar sesión, el WebSocket conecta (se emite handshake), y enviar un mensaje HTTP a /webhook hace que aparezca en la interfaz React de inmediato sin recargar la página.
