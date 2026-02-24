#!/bin/bash
# Test end-to-end Fase 2 — Bot IA con integración PMS
# Ejecutar: bash docs/test-fase2.sh

SECRET="meta_app_secret"
URL="http://localhost:3001/webhook/whatsapp"
PHONE="+56900000001"
CLIENT="+56912345678"

send_webhook() {
  local TEXT="$1"
  local MSG_ID="wamid_$(date +%s%N)"
  local TIMESTAMP="$(date +%s)"

  local PAYLOAD='{
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "'"$PHONE"'",
                "phone_number_id": "TEST_PHONE_ID"
              },
              "contacts": [
                {
                  "profile": {
                    "name": "Cliente Test"
                  },
                  "wa_id": "'"$CLIENT"'"
                }
              ],
              "messages": [
                {
                  "from": "'"$CLIENT"'",
                  "id": "'"$MSG_ID"'",
                  "timestamp": "'"$TIMESTAMP"'",
                  "type": "text",
                  "text": {
                    "body": "'"$TEXT"'"
                  }
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  }'

  local SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d" " -f1)

  echo "📤 Enviando: \"$TEXT\""
  local RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "x-hub-signature-256: sha256=$SIGNATURE" \
    --data-binary "$PAYLOAD")
  
  echo "   → HTTP Status: $RESPONSE"
  
  if [ "$RESPONSE" = "200" ]; then
    echo "   ✅ Webhook aceptado"
  else
    echo "   ❌ Error en webhook"
  fi
  echo ""
  sleep 3
}

echo "🧪 Test Fase 2 — Bot IA + PMS Integration"
echo "==========================================="
echo ""

# Test 1: Saludo
echo "--- Test 1: Saludo ---"
send_webhook "Hola, buenas tardes"

# Test 2: Disponibilidad
echo "--- Test 2: Disponibilidad ---"
send_webhook "Tienen pieza para esta noche?"

# Test 3: Precios
echo "--- Test 3: Precios ---"
send_webhook "Cuánto vale la suite?"

echo "==========================================="
echo "✅ Tests enviados. Revisar:"
echo "   docker compose logs wa-api --tail=50"
echo "   SELECT contenido, direccion FROM mensajes ORDER BY created_at DESC LIMIT 10;"
