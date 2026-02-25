# Manual de Despliegue en Producción 🚀

Este runbook describe los pasos para desplegar "Moteland" en un servidor (VPS) limpio corriendo Linux (Ubuntu/Debian recomendado).

## Requisitos Previos

- Un VPS con Docker y Docker Compose instalados.
- Nombres de dominio/subdominios apuntando a la IP pública del servidor:
  - `admin.tudominio.com` (Dashboard React)
  - `api.tudominio.com` (API Backend)
  - `webhook.tudominio.com` (Para recibir eventos de Meta)

## Pasos de Instalación

1. **Clonar el Repositorio**
   ```bash
   git clone <URL_REPO> /opt/moteland
   cd /opt/moteland
   ```

2. **Configurar Entorno**
   Copia el archivo de ejemplo y configura los tokens de Meta, OpenAI, JWT y Postgres.
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Generar Certificados SSL (Certbot)**
   Antes de arrancar Nginx, necesitamos los certificados SSL para que no falle.
   ```bash
   # Generar un certificado de prueba/standby o correr Certbot si tienes los dominios listos.
   sudo certbot certonly --standalone -d admin.tudominio.com -d api.tudominio.com -d webhook.tudominio.com
   ```
   Asegúrate de cambiar las rutas en `infra/nginx.prod.conf` para apuntar a los certificados que generes (`/etc/letsencrypt/live/...`).

4. **Primer Despliegue**
   El sistema provee un script automatizado que hace pull, build, y levanta el servicio.
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

## Onboarding de Nuevos Clientes (Tenants)

Para añadir un nuevo cliente al sistema SaaS:

1. Entra al servidor (SSH) y navega al directorio de deploy.
2. Corre el asistente interactivo:
   ```bash
   # Primero entramos al contenedor de la API (estamos usando Prisma y el código de backend está allí)
   docker exec -it moteland_api node scripts/onboard-tenant.js
   ```
   *(Nota: Alternativamente, si tienes Node.js intalado en el Host y alcanzas las variables DATABASE_URL de la red privada apuntando vía port-forwarding, puedes correrlo localmente).*
3. Sigue los pasos en pantalla.
4. El cliente ya podrá acceder a `admin.tudominio.com` y su endpoint de Webhook de WhatsApp estará activo para su Phone ID.

## Monitoreo Básico

Para ver los logs del bot en tiempo real:
```bash
docker compose -f docker-compose.prod.yml logs -f wa-api
```

Para ver el uso de recursos CPU/RAM:
```bash
docker stats
```
