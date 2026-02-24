import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import config from '../config/index.js';
import { detectIntent, generateResponse } from './intentDetector.js';
import { buildSystemPrompt } from './promptManager.js';
import { getConversationHistory, invalidateHistoryCache, buildContext } from './contextBuilder.js';
import { sendTextMessage, markAsRead } from '../whatsapp/sender.js';
import { fillTemplate } from '../whatsapp/templates.js';
import { handleDisponibilidad } from './handlers/disponibilidad.js';
import { handlePrecios } from './handlers/precios.js';
import { handleReserva } from './handlers/reserva.js';
import { handleSaludo } from './handlers/saludo.js';
import { handleDesconocido } from './handlers/desconocido.js';
import { initiateHandover } from './handover.js';

const HANDLERS = {
    DISPONIBILIDAD: handleDisponibilidad,
    PRECIOS: handlePrecios,
    RESERVA: handleReserva,
    SALUDO: handleSaludo,
    DESPEDIDA: null,
    CONSULTA_GENERAL: handleDesconocido,
    DESCONOCIDO: handleDesconocido
};

class WhatsAppAgent {
    async process(rawMessage, tenant) {
        const start = Date.now();
        const from = rawMessage.from;
        const messageId = rawMessage.id;
        const contenido = rawMessage.text?.body || rawMessage.body || '';

        try {
            // 1. Verify tenant active
            if (!tenant.activo) {
                logger.info('Tenant inactive, ignoring message', { tenantId: tenant.id });
                return;
            }

            // 2. Check business hours
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const inicio = tenant.horario_inicio || '00:00';
            const fin = tenant.horario_fin || '23:59';

            if (currentTime < inicio || currentTime > fin) {
                const texto = fillTemplate('FUERA_HORARIO', { hora_inicio: inicio });
                await sendTextMessage(from, texto, tenant.whatsapp_phone_id, config.whatsapp.token);
                return;
            }

            // 3. Find or create conversation
            let conversacion = await prisma.conversacion.findFirst({
                where: {
                    tenant_id: tenant.id,
                    whatsapp_contact: from,
                    estado: { in: ['BOT', 'HUMANO'] }
                },
                orderBy: { created_at: 'desc' }
            });

            if (!conversacion) {
                conversacion = await prisma.conversacion.create({
                    data: {
                        tenant_id: tenant.id,
                        whatsapp_contact: from,
                        contact_name: rawMessage.contact_name || null,
                        estado: tenant.modo_bot ? 'BOT' : 'HUMANO',
                        ultimo_mensaje_at: new Date()
                    }
                });
            }

            // 4. Save incoming message (if not already saved by webhook processor)
            try {
                await prisma.mensaje.create({
                    data: {
                        conversacion_id: conversacion.id,
                        tenant_id: tenant.id,
                        whatsapp_message_id: messageId || `agent_${Date.now()}`,
                        direccion: 'ENTRANTE',
                        tipo: 'TEXTO',
                        contenido,
                        created_at: new Date()
                    }
                });
                await invalidateHistoryCache(conversacion.id);
            } catch (err) {
                if (err.code !== 'P2002') throw err;
                // Duplicate — already saved by webhook processor
            }

            // 5. If conversation is in HUMANO mode, don't process with bot
            if (conversacion.estado === 'HUMANO') {
                logger.info('Conversation in HUMANO mode, skipping bot', { conversacionId: conversacion.id });
                return;
            }

            // 6. If tenant has bot mode disabled, handover directly
            if (!tenant.modo_bot) {
                await this._handover(conversacion, tenant, from);
                return;
            }

            // 7. Mark message as read
            if (messageId) {
                await markAsRead(messageId, tenant.whatsapp_phone_id, config.whatsapp.token);
            }

            // 8. Detect intent
            const fechaHoy = new Date().toISOString().split('T')[0];
            const intent = await detectIntent(contenido, fechaHoy);
            logger.info('Intent detected', { intent: intent.intent, conversacionId: conversacion.id });

            // 9. Handle DESPEDIDA specially
            if (intent.intent === 'DESPEDIDA') {
                const texto = fillTemplate('DESPEDIDA');
                await this._sendAndSave(from, texto, tenant, conversacion);
                return;
            }

            // 10. Select and execute handler
            const handler = HANDLERS[intent.intent] || handleDesconocido;
            const result = await handler({
                tenant,
                conversacion,
                mensaje: contenido,
                entidades: intent
            });

            // 11. Handle handover
            if (result.handover) {
                if (result.respuesta) {
                    await this._sendAndSave(from, result.respuesta, tenant, conversacion);
                }

                await initiateHandover(conversacion, tenant, contenido);
                logger.info('Conversation handed over to human', { conversacionId: conversacion.id });
                return;
            }

            // 12. Send bot response
            if (result.respuesta) {
                await this._sendAndSave(from, result.respuesta, tenant, conversacion);
            }

            const duration = Date.now() - start;
            logger.info('Message processed by bot', { conversacionId: conversacion.id, intent: intent.intent, duration });

        } catch (err) {
            logger.error('WhatsAppAgent.process failed', { from, tenantId: tenant.id, error: err.message, stack: err.stack });

            // Fallback: handover to human
            try {
                const errorMsg = fillTemplate('ERROR_GENERAL');
                await sendTextMessage(from, errorMsg, tenant.whatsapp_phone_id, config.whatsapp.token);
            } catch (sendErr) {
                logger.error('Failed to send error message', { error: sendErr.message });
            }
        }
    }

    async _sendAndSave(to, text, tenant, conversacion) {
        const result = await sendTextMessage(to, text, tenant.whatsapp_phone_id, config.whatsapp.token);

        await prisma.mensaje.create({
            data: {
                conversacion_id: conversacion.id,
                tenant_id: tenant.id,
                whatsapp_message_id: result.messageId || `bot_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                direccion: 'SALIENTE',
                tipo: 'TEXTO',
                contenido: text,
                created_at: new Date()
            }
        });

        await invalidateHistoryCache(conversacion.id);
        await prisma.conversacion.update({
            where: { id: conversacion.id },
            data: { ultimo_mensaje_at: new Date() }
        });
    }

    async _handover(conversacion, tenant, from) {
        await initiateHandover(conversacion, tenant, 'Bot desactivado — handover directo');
    }
}

export const whatsappAgent = new WhatsAppAgent();
export default whatsappAgent;
