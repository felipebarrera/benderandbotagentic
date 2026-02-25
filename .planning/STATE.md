# STATE.md — Estado actual del proyecto

## Posición actual

- **Milestone**: 1 — MVP Producción
- **Fase activa**: 6 — Multi-Tenant Completo y Deploy Final
- **Estado**: Fase 5 Completada

## Decisiones tomadas

| Decisión | Elegido | Razón |
|----------|---------|-------|
| ORM | Prisma | Type-safe, migraciones automáticas |
| Cola | BullMQ | Mejor que Redis pub/sub para retry logic |
| Auth | JWT stateless | Sin sesiones en servidor — escala mejor |
| IA | GPT-4o-mini | Más barato que GPT-4, suficiente para intención |
| Frontend | React sin TypeScript v1 | Velocidad de desarrollo — TS en v2 |
| Bridge agentes | Nanobot Telegram primero, Twilio en v2 | Costo y complejidad |

## Blockers conocidos

- [ ] Verificación de cuenta Meta Business (puede tardar 1-2 semanas)
- [ ] Número de WhatsApp Business dedicado por tenant

## Próximas decisiones pendientes

- Schema exacto de `configuracion_tenant` (qué campos configurables)
- Política de retention de mensajes en DB

## Notas de sesión

- Infraestructura Docker generada y lista en `/infra/`
- Constitution, AGENTS.md, PROJECT.md, REQUIREMENTS.md y ROADMAP.md completos
- App legacy en `motelmultiempresa/` — intocable
- Proyecto clonado en `whatsappbotagentic/`
