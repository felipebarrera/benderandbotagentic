#!/bin/bash
# Configurar webhook de Telegram para recibir updates
# Requiere: TELEGRAM_BOT_TOKEN y DOMAIN configurados

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "Error: TELEGRAM_BOT_TOKEN no configurado"
  exit 1
fi

DOMAIN="${DOMAIN:-wa-api.tudominio.cl}"
SECRET="${TELEGRAM_WEBHOOK_SECRET:-$(openssl rand -hex 32)}"

echo "Registrando webhook de Telegram..."
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://${DOMAIN}/api/telegram/webhook\", \"secret_token\": \"${SECRET}\"}"

echo ""
echo ""
echo "Verificando webhook..."
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
echo ""
echo ""
echo "Secret token: $SECRET"
echo "Agregar a .env: TELEGRAM_WEBHOOK_SECRET=$SECRET"
