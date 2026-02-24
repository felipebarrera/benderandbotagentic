# AGENTS.md — Moteland WhatsApp Multiagente

## ¿Qué es este proyecto?

Sistema SaaS de atención inteligente por WhatsApp para moteles y negocios chilenos.
Un bot con IA responde automáticamente, y cuando no puede, transfiere al dueño del negocio.
El dueño responde desde su Telegram o WhatsApp personal y el mensaje llega al cliente.

## Tu rol como agente

Eres el ejecutor. Recibes planes estructurados (XML) del sistema GSD y los implementas.
No inventes funcionalidades no especificadas. No cambies el stack. Sigue la Constitution.

**Antes de cualquier tarea, lee:** `memory/constitution.md`

## Contexto del codebase

### Lo que YA existe (no tocar)
- `/home/master/Documentos/sitiosweb/docker/src/motelmultiempresa/` — PMS legacy completo
- Infraestructura Docker ya configurada en `docker-compose.yml`

### Lo que estás construyendo
El módulo `whatsappbotagentic/` — nuevo, desde cero, sin interferir con el PMS.

## Modelos a usar por tipo de tarea

| Tarea | Modelo preferido |
|-------|-----------------|
| Arquitectura, módulos complejos, lógica de negocio | Gemini 2.5 Pro Preview |
| Scripts, configs, tests, código repetitivo | Gemini Flash |
| Verificación visual en browser | Browser agent integrado |

## Flujo de trabajo esperado

Cuando recibes un `/execute`:
1. Lee el PLAN.md de la fase actual en `.planning/`
2. Lee `memory/constitution.md` para las reglas
3. Implementa cada tarea del plan en orden (o paralelo si son independientes)
4. Haz commit atómico por tarea: `feat(módulo): descripción`
5. Verifica que el servicio pasa su healthcheck
6. Actualiza `.planning/STATE.md` con lo completado

## Comandos útiles en el VPS

```bash
# Ver estado de servicios
cd /home/master/Documentos/sitiosweb/docker/src/infra
docker compose ps

# Ver logs en tiempo real
docker compose logs -f wa-api wa-worker

# Rebuild después de cambios
docker compose build wa-api && docker compose up -d wa-api

# Entrar a PostgreSQL
docker compose exec postgres psql -U moteland -d moteland_whatsapp

# Test webhook local
curl -X POST http://localhost:3001/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Señales de éxito por fase

- **Fase 1**: `curl http://localhost:3001/health` responde `{"status":"ok"}`
- **Fase 2**: Bot responde a un mensaje de WhatsApp real en < 3 segundos
- **Fase 3**: Handover funciona — mensaje llega al Telegram del dueño
- **Fase 4**: Dashboard muestra conversación en tiempo real
- **Fase 5**: Multi-tenant — 2 moteles en el mismo sistema sin mezclar datos

## No hagas esto

- No toques `motelmultiempresa/` por ningún motivo
- No expongas PostgreSQL o Redis fuera de la red Docker
- No uses `console.log` — solo Winston logger
- No hardcodees ningún valor que debería ser variable de entorno
- No hagas commits con archivos `.env` reales
