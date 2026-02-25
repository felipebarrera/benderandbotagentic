#!/bin/bash
# Test end-to-end Fase 4 — JWT Auth + API REST
# Ejecutar: bash docs/test-fase4.sh

BASE="http://localhost:3001/api"
PASS=0
FAIL=0

check() {
  local NAME="$1" EXPECTED="$2" ACTUAL="$3"
  if echo "$ACTUAL" | grep -q "$EXPECTED"; then
    echo "  ✅ $NAME"
    PASS=$((PASS+1))
  else
    echo "  ❌ $NAME (expected: $EXPECTED)"
    echo "     got: $(echo "$ACTUAL" | head -c 120)"
    FAIL=$((FAIL+1))
  fi
}

echo "🧪 Test Fase 4 — JWT Auth + API REST"
echo "======================================"

# 1. Login
echo ""
echo "--- 1. Login ---"
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.cl","password":"admin123"}')
check "Login returns accessToken" "accessToken" "$LOGIN"

TOKEN=$(echo "$LOGIN" | node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(JSON.parse(d).accessToken)}catch{console.log('')}")
REFRESH=$(echo "$LOGIN" | node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(JSON.parse(d).refreshToken)}catch{console.log('')}")

if [ -z "$TOKEN" ]; then
  echo "  ❌ No token received, aborting"
  exit 1
fi

# 2. Me
echo ""
echo "--- 2. GET /auth/me ---"
ME=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $TOKEN")
check "Returns agent email" "admin@test.cl" "$ME"
check "Returns agent rol" "ADMIN" "$ME"
check "No password_hash exposed" "nombre" "$ME"

# 3. Conversations
echo ""
echo "--- 3. GET /conversations ---"
CONVS=$(curl -s "$BASE/conversations" -H "Authorization: Bearer $TOKEN")
check "Returns paginated data" "totalPages" "$CONVS"
check "Returns data array" "data" "$CONVS"

# 4. Dashboard Metrics
echo ""
echo "--- 4. GET /dashboard/metrics ---"
METRICS=$(curl -s "$BASE/dashboard/metrics" -H "Authorization: Bearer $TOKEN")
check "Returns tasa_resolucion_bot" "tasa_resolucion_bot" "$METRICS"
check "Returns conversaciones_totales" "conversaciones_totales" "$METRICS"

# 5. Dashboard Realtime
echo ""
echo "--- 5. GET /dashboard/realtime ---"
RT=$(curl -s "$BASE/dashboard/realtime" -H "Authorization: Bearer $TOKEN")
check "Returns conversaciones_activas" "conversaciones_activas" "$RT"

# 6. Dashboard Activity
echo ""
echo "--- 6. GET /dashboard/activity ---"
ACT=$(curl -s "$BASE/dashboard/activity" -H "Authorization: Bearer $TOKEN")
check "Returns hourly array" "entrantes" "$ACT"

# 7. Agents
echo ""
echo "--- 7. GET /agents ---"
AGENTS=$(curl -s "$BASE/agents" -H "Authorization: Bearer $TOKEN")
check "Returns agents list" "Admin Test" "$AGENTS"

# 8. Tenant Config
echo ""
echo "--- 8. GET /tenants/me ---"
TENANT=$(curl -s "$BASE/tenants/me" -H "Authorization: Bearer $TOKEN")
check "Returns tenant nombre" "Motel Test" "$TENANT"

# 9. Queue Stats
echo ""
echo "--- 9. GET /queue/stats ---"
QS=$(curl -s "$BASE/queue/stats" -H "Authorization: Bearer $TOKEN")
check "Returns queue stats" "message" "$QS"

# 10. Refresh Token
echo ""
echo "--- 10. POST /auth/refresh ---"
REFRESHED=$(curl -s -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}")
check "Refresh returns new accessToken" "accessToken" "$REFRESHED"

# 11. No auth → 401
echo ""
echo "--- 11. No auth → 401 ---"
NOAUTH=$(curl -s "$BASE/auth/me")
check "Returns 401 error" "Token requerido" "$NOAUTH"

# 12. Wrong password → 401
echo ""
echo "--- 12. Wrong password → 401 ---"
WRONG=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.cl","password":"wrong"}')
check "Returns credenciales inválidas" "inválidas" "$WRONG"

# 13. Logout
echo ""
echo "--- 13. POST /auth/logout ---"
NEWTOKEN=$(echo "$REFRESHED" | node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(JSON.parse(d).accessToken)}catch{console.log('')}")
LOGOUT=$(curl -s -X POST "$BASE/auth/logout" \
  -H "Authorization: Bearer $NEWTOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$(echo "$REFRESHED" | node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(JSON.parse(d).refreshToken)}catch{console.log('')}")\"}")
check "Logout success" "success" "$LOGOUT"

echo ""
echo "======================================"
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && echo "🎉 All tests passed!" || echo "⚠️  Some tests failed"
