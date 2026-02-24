# Test Fase 2 — Guía de Verificación

## Prerequisitos

1. Docker con PostgreSQL y Redis corriendo
2. `.env` configurado con `OPENAI_API_KEY` real
3. Tenant de prueba creado via `npm run db:seed`

## Ejecutar tests

```bash
# Rebuild y levantar servicios
docker compose up -d --build wa-api

# Ejecutar tests
bash docs/test-fase2.sh

# Ver logs del API (incluye worker en el mismo proceso)
docker compose logs wa-api --tail=50
```

## Escenarios de test

| # | Mensaje | Intent esperado | Respuesta esperada |
|---|---------|----------------|-------------------|
| 1 | "Hola, buenas tardes" | SALUDO | Saludo personalizado de Motel Test |
| 2 | "Tienen pieza para esta noche?" | DISPONIBILIDAD | Info de disponibilidad o error PMS |
| 3 | "Cuánto vale la suite?" | PRECIOS | Lista de precios o error PMS |

## Verificar en DB

```bash
docker compose exec postgres psql -U postgres -d moteland_whatsapp -c \
  "SELECT direccion, contenido FROM mensajes ORDER BY created_at DESC LIMIT 10;"
```

## Configurar sandbox de Meta (para pruebas con WhatsApp real)

1. Ir a [Meta for Developers](https://developers.facebook.com/)
2. Crear app tipo "Business" → WhatsApp
3. En WhatsApp → Getting Started: copiar el token temporal
4. Agregar tu número personal como destinatario de prueba
5. Configurar webhook URL con ngrok: `ngrok http 3001`
6. Usar la URL de ngrok + `/webhook/whatsapp` como callback URL
7. Verificar con el `WHATSAPP_VERIFY_TOKEN` configurado en `.env`

## Notas

- Si el PMS Moteland no está corriendo, el bot responderá con mensajes de error graceful
- Las respuestas del bot se envían a la API de Meta; si no hay token configurado, se registran como error en los logs pero el flujo no se rompe
- El bot guarda tanto mensajes entrantes como salientes en la tabla `mensajes`
