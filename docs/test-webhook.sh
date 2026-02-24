#!/bin/bash
SECRET="meta_app_secret"
URL="http://localhost:3001/webhook/whatsapp"
PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "+56900000001",
              "phone_number_id": "TEST_PHONE_ID"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Cliente Test"
                },
                "wa_id": "+56912345678"
              }
            ],
            "messages": [
              {
                "from": "+56912345678",
                "id": "wamid_'$(date +%sN)'",
                "timestamp": "'$(date +%s)'",
                "type": "text",
                "text": {
                  "body": "Hola, necesito una habitación"
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
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d" " -f1)
curl -s -X POST "$URL" -H "Content-Type: application/json" -H "x-hub-signature-256: sha256=$SIGNATURE" --data-binary "$PAYLOAD"
echo "\nWebhook tester completado"
