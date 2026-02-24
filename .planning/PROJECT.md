# PROJECT.md — Moteland WhatsApp Multiagente

## Visión

Sistema SaaS multi-tenant de atención por WhatsApp para moteles y negocios chilenos.
Bot con IA atiende 24/7. Cuando no puede, transfiere al dueño en tiempo real.
Dashboard muestra todo en vivo. Integrado nativamente con el PMS Moteland existente.

## Problema que resuelve

Los dueños de motel manejan el WhatsApp personalmente. Pierden reservas de madrugada,
no pueden atender mientras están ocupados, y no tienen visibilidad de qué pasa.
Ningún competidor tiene integración nativa con un PMS de motel — nosotros sí.

## Usuarios

- **Dueño de motel**: recibe alertas en Telegram, responde desde ahí
- **Agente humano** (si hay staff): responde desde dashboard web
- **Cliente final**: solo ve WhatsApp — no sabe que hay un bot

## Stack completo

Ver `memory/constitution.md` para detalle de stack, convenciones y reglas.

## Integraciones

- **PMS Moteland Legacy**: `http://motelmulti:3000/api` (read + crear reservas simples)
- **Meta WhatsApp Cloud API v18.0**: webhook + envío de mensajes
- **OpenAI GPT-4o-mini**: detección de intención + generación de respuestas
- **Twilio** (fase 3): bridge para agentes que responden desde WhatsApp personal

## Restricciones

- App legacy en `motelmultiempresa/` es intocable
- Todo en Docker en el VPS Antigravity Google Cloud existente
- Presupuesto mínimo — sin servicios de pago innecesarios
- Tiempo de desarrollo: 3 semanas para MVP con 3 clientes reales

## Métricas de éxito

- Bot responde en < 3 segundos
- 0 mensajes perdidos (queue con retry)
- Multi-tenant: datos de clientes 100% aislados
- Dashboard actualiza en < 1 segundo (Socket.io)
- Uptime 99%+ en producción
