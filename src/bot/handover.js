import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { logger } from '../config/logger.js';
import { sendTextMessage } from '../whatsapp/sender.js';
import config from '../config/index.js';
import { fillTemplate } from '../whatsapp/templates.js';
import { addNotificationJob, addHandoverJob } from '../queue/index.js';
import { invalidateHistoryCache } from './contextBuilder.js';
import { emitToTenant } from '../socket/index.js';

export const initiateHandover = async (conversacion, tenant, mensajeTrigger) => {
    // 1. Change conversation state to HUMANO
    const updatedConv = await prisma.conversacion.update({
        where: { id: conversacion.id },
        data: {
            estado: 'HUMANO',
            handover_at: new Date()
        },
        include: { agente: true }
    });

    emitToTenant(tenant.id, 'conversation_update', updatedConv);

    // 2. Add to wait queue
    await prisma.colaEspera.create({
        data: {
            tenant_id: tenant.id,
            conversacion_id: conversacion.id,
            prioridad: 0
        }
    });

    // 3. Send handover notice to client
    const aviso = fillTemplate('HANDOVER_AVISO');
    await sendTextMessage(conversacion.whatsapp_contact, aviso, tenant.whatsapp_phone_id, config.whatsapp.token);

    // Save outgoing message
    const newMsg = await prisma.mensaje.create({
        data: {
            conversacion_id: conversacion.id,
            tenant_id: tenant.id,
            whatsapp_message_id: `handover_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            direccion: 'SALIENTE',
            tipo: 'SISTEMA',
            contenido: aviso,
            created_at: new Date()
        }
    });
    await invalidateHistoryCache(conversacion.id);

    emitToTenant(tenant.id, 'new_message', newMsg);

    // 4. Enqueue notification job for Telegram
    await addNotificationJob({
        tenantId: tenant.id,
        conversacionId: conversacion.id,
        mensaje: mensajeTrigger
    });

    // 5. Enqueue delayed handover timeout check (5 minutes)
    await addHandoverJob({
        conversacionId: conversacion.id,
        tenantId: tenant.id,
        timestamp: Date.now()
    });

    // 6. Set Redis key for active handover
    await redis.setex(`handover:${conversacion.id}`, 600, Date.now().toString());

    logger.info('Handover initiated', { conversacionId: conversacion.id, tenantId: tenant.id });
};

export const resolveHandover = async (conversacionId, resolucion) => {
    const conversacion = await prisma.conversacion.findUnique({
        where: { id: conversacionId },
        include: { tenant: true }
    });

    if (!conversacion) return;

    // Remove from wait queue
    await prisma.colaEspera.deleteMany({ where: { conversacion_id: conversacionId } });

    if (resolucion === 'timeout') {
        const updatedConv = await prisma.conversacion.update({
            where: { id: conversacionId },
            data: {
                estado: 'BOT',
                handover_resolved_at: new Date(),
                handover_resolution: 'timeout'
            },
            include: { agente: true }
        });

        emitToTenant(conversacion.tenant_id, 'conversation_update', updatedConv);

        // Import here to avoid circular deps
        const { notifyTimeout } = await import('../notifications/index.js');
        await notifyTimeout(conversacion.tenant, conversacion);

        logger.info('Handover timeout resolved', { conversacionId });
    } else if (resolucion === 'tomado') {
        const updatedConv = await prisma.conversacion.update({
            where: { id: conversacionId },
            data: {
                handover_resolved_at: new Date(),
                handover_resolution: 'tomado'
            },
            include: { agente: true }
        });

        emitToTenant(conversacion.tenant_id, 'conversation_update', updatedConv);
    } else if (resolucion === 'cerrado') {
        const updatedConv = await prisma.conversacion.update({
            where: { id: conversacionId },
            data: {
                estado: 'CERRADA',
                handover_resolved_at: new Date(),
                handover_resolution: 'cerrado'
            },
            include: { agente: true }
        });

        emitToTenant(conversacion.tenant_id, 'conversation_update', updatedConv);
    }

    // Cleanup Redis
    await redis.del(`handover:${conversacionId}`);
};
