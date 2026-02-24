#!/bin/bash
# Test end-to-end Fase 3 — Handover y Telegram
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
    "entry": [{"id": "BIZ_ID","changes": [{"value": {"messaging_product": "whatsapp","metadata": {"display_phone_number": "'"$PHONE"'","phone_number_id": "TEST_PHONE_ID"},"contacts": [{"profile": {"name": "Cliente Test"},"wa_id": "'"$CLIENT"'"}],"messages": [{"from": "'"$CLIENT"'","id": "'"$MSG_ID"'","timestamp": "'"$TIMESTAMP"'","type": "text","text": {"body": "'"$TEXT"'"}}]},"field": "messages"}]}]}'
  local SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d" " -f1)
  local RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL" -H "Content-Type: application/json" -H "x-hub-signature-256: sha256=$SIGNATURE" --data-binary "$PAYLOAD")
  echo "📤 \"$TEXT\" → HTTP $RESPONSE"
  sleep 2
}

echo "🧪 Test Fase 3 — Handover + Telegram"
echo "======================================"

# Step 1: Send unknown message to trigger handover
echo ""
echo "--- Step 1: Trigger handover ---"
send_webhook "quiero hablar con alguien por un reclamo urgente"

# Step 2: Verify conversation is in HUMANO state
echo ""
echo "--- Step 2: Verify HUMANO state ---"
docker compose exec postgres psql -U postgres -d moteland_whatsapp -c \
  "SELECT estado, handover_at IS NOT NULL as has_handover FROM conversaciones ORDER BY created_at DESC LIMIT 1;" 2>/dev/null

# Step 3: Simulate Telegram owner response
echo ""
echo "--- Step 3: Simulate Telegram /tomar ---"
curl -s -X POST "http://localhost:3001/api/telegram/webhook" \
  -H "Content-Type: application/json" \
  -d '{"update_id":1,"message":{"message_id":1,"from":{"id":12345,"first_name":"Dueño"},"chat":{"id":12345},"text":"/tomar"}}'
echo ""

# Step 4: Simulate Telegram /bot to return control
echo ""
echo "--- Step 4: Simulate Telegram /bot ---"
sleep 1
curl -s -X POST "http://localhost:3001/api/telegram/webhook" \
  -H "Content-Type: application/json" \
  -d '{"update_id":2,"message":{"message_id":2,"from":{"id":12345,"first_name":"Dueño"},"chat":{"id":12345},"text":"/bot"}}'
echo ""

# Step 5: Check API endpoints
echo ""
echo "--- Step 5: API endpoints ---"
echo "Queue stats:"
curl -s http://localhost:3001/api/queue/stats
echo ""
echo "Active handovers:"
curl -s http://localhost:3001/api/handover/active
echo ""

echo ""
echo "======================================"
echo "✅ Test completado. Revisar logs: docker compose logs wa-api --tail=30"
