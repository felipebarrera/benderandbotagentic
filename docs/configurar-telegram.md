# Configurar Telegram para Moteland WhatsApp Bot

## Paso 1: Crear Bot en Telegram

1. Abrir Telegram y buscar `@BotFather`
2. Enviar `/newbot`
3. Nombre: `Moteland Alertas` (o el nombre de tu negocio)
4. Username: `moteland_alertas_bot` (debe terminar en `_bot`)
5. Copiar el **token** que te da BotFather

## Paso 2: Obtener tu Chat ID

1. Buscar `@userinfobot` en Telegram
2. Enviarle cualquier mensaje
3. Te responderá con tu **chat ID** (un número)

## Paso 3: Configurar en el sistema

```bash
# En .env del proyecto
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...  # Token de BotFather
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)

# En la base de datos
docker compose exec postgres psql -U postgres -d moteland_whatsapp -c \
  "UPDATE tenants SET telegram_chat_id='TU_CHAT_ID' WHERE nombre='Motel Test';"
```

## Paso 4: Registrar webhook

```bash
bash scripts/setup-telegram-webhook.sh
```

## Paso 5: Probar

Envía un mensaje al número de WhatsApp con algo que el bot no entienda (ej: "quiero hacer un reclamo").
Deberías recibir una alerta en tu Telegram con botones para tomar la conversación.

## Comandos disponibles desde Telegram

| Comando | Acción |
|---------|--------|
| `/tomar` | Tomar control de la conversación activa |
| `/bot` | Devolver control al bot |
| `/cerrar` | Cerrar la conversación |
| *(texto normal)* | Enviar respuesta al cliente de WhatsApp |
