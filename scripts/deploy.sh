#!/bin/bash
set -e

echo "🚀 Iniciando despliegue de Moteland a Producción..."

# 1. Pull latest code
echo "📦 Descargando últimos cambios..."
git pull origin main

# 2. Rebuild images and start containers
echo "🏗️  Construyendo y levantando contenedores..."
docker compose -f docker-compose.prod.yml up -d --build

# 3. Prisma Migrations / DB Push
echo "🗄️  Asegurando esquema de base de datos..."
docker compose -f docker-compose.prod.yml exec -T wa-api npx prisma db push --accept-data-loss

echo "✅ Despliegue finalizado exitosamente."
docker compose -f docker-compose.prod.yml ps
