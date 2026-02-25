# Fase 6 — Multi-Tenant Completo y Deploy Final
# PLAN COMPLETO

## Objetivo
Configurar el proyecto para que soporte múltiples clientes (tenants) simultáneamente de manera segura en producción, y proveer las herramientas necesarias para operarlo.

## Arquitectura y Diseño
- **Onboarding CLI**: Un script Node.js interactivo para crear nuevos Tenants y sus Agentes Administradores en la base de datos de producción de forma segura.
- **Docker Production**: Un archivo `docker-compose.prod.yml` optimizado y un proxy Nginx inverso configurado para enrutar tráfico usando subdominios o puertos organizados, con soporte para HTTPS (Certbot/Let's Encrypt).
- **Aislamiento de Datos**: Comprobaremos que el middleware `authResolver` de la Fase 1 y `tenantId` en Prisma realmente filtren todo, añadiendo tenants adicionales al seed de desarrollo y verificando el aislamiento con el script end-to-end.
- **Monitoreo**: Un script `scripts/monitor.js` o notificaciones automáticas vía Telegram si el servicio se cae.

---

## Tareas — Wave 1: Herramientas de Operación
1. Crear `scripts/onboard-tenant.js`:
   - Pedir datos interactivos (Nombre, Whatsapp Phone ID, Token de Telegram).
   - Pedir datos del Admin (Email, Contraseña).
   - Hashear contraseña y persistir en la DB.
2. Modificar `prisma/seed.js` para crear 3 Tenants distintos (Motel A, Motel B, Repuestos C) y validar que las conversaciones estén 100% aisladas visualmente en el Dashboard.

## Tareas — Wave 2: Infraestructura de Producción
1. Crear `docker-compose.prod.yml`:
   - Sin puertos expuestos excepto Nginx (80/443).
   - Redis y Postgres persistentes y cerrados al exterior.
2. Crear `infra/nginx.prod.conf`:
   - Template para Nginx con bloques de server para HTTPS.
3. Crear `scripts/deploy.sh`: Script automatizado para hacer `git pull`, build y up.

## Tareas — Wave 3: Documentación
1. Redactar `docs/deploy.md` (Runbook).

## Señal de éxito
Lograr agregar un tenant usando el comando por terminal, hacer login en el dashboard con ese tenant, y verificar que no vemos mensajes del tenant de prueba.
