import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import config from '../config/index.js';
import { Worker } from 'bullmq';
import { whatsappAgent } from '../bot/agent.js';

export const extractMessages = (payload) => {
    const messages = [];

    if (
        payload.entry &&
        payload.entry[0].changes &&
        payload.entry[0].changes[0].value &&
        payload.entry[0].changes[0].value.messages
    ) {
        const changes = payload.entry[0].changes[0].value;
        const contact = changes.contacts && changes.contacts.length > 0 ? changes.contacts[0] : null;

        for (const msg of changes.messages) {
            messages.push({
                message: msg,
                contact: contact,
                metadata: changes.metadata
            });
        }
    }

    return messages;
};

export const saveMessage = async (msgData, tenant) => {
    const { message, contact } = msgData;
    const from = message.from;
    const name = contact ? contact.profile.name : null;
    const messageId = message.id;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);

    let type = 'TEXTO';
    let content = '';

    if (message.type === 'text') {
        content = message.text.body;
    } else if (message.type === 'audio') {
        type = 'AUDIO';
        content = message.audio.id;
    } else if (message.type === 'image') {
        type = 'IMAGEN';
        content = message.image.id;
    } else {
        type = 'SISTEMA';
        content = `Mensaje tipo: ${message.type}`;
    }

    let conversacion = await prisma.conversacion.findFirst({
        where: {
            tenant_id: tenant.id,
            whatsapp_contact: from,
            estado: { in: ['BOT', 'HUMANO'] }
        },
        orderBy: { created_at: 'desc' }
    });

    let isNewConv = false;
    if (!conversacion) {
        conversacion = await prisma.conversacion.create({
            data: {
                tenant_id: tenant.id,
                whatsapp_contact: from,
                contact_name: name,
                estado: tenant.modo_bot ? 'BOT' : 'HUMANO',
                ultimo_mensaje_at: timestamp
            }
        });
        isNewConv = true;
    } else {
        conversacion = await prisma.conversacion.update({
            where: { id: conversacion.id },
            data: {
                ultimo_mensaje_at: timestamp,
                ...(name && !conversacion.contact_name ? { contact_name: name } : {})
            },
            include: { agente: true }
        });
    }

    try {
        const { emitToTenant } = await import('../socket/index.js');
        if (isNewConv) {
            emitToTenant(tenant.id, 'conversation_update', conversacion);
        } else {
            emitToTenant(tenant.id, 'conversation_update', conversacion);
        }

        const savedMessage = await prisma.mensaje.create({
            data: {
                conversacion_id: conversacion.id,
                tenant_id: tenant.id,
                whatsapp_message_id: messageId,
                direccion: 'ENTRANTE',
                tipo: type,
                contenido: content,
                created_at: timestamp
            }
        });

        // Wait, bot.agent emits new_message but if a message is a media type or not text, agent doesn't process it.
        // It's safer to let the worker emit new_message, EXCEPT agent also creates new message entries.
        // I will emit 'new_message' here and the frontend can deduplicate by ID.
        emitToTenant(tenant.id, 'new_message', savedMessage);

        return savedMessage;
    } catch (err) {
        if (err.code === 'P2002') {
            logger.warn(`Mensaje duplicado ignorado: ${messageId}`);
            return null;
        }
        throw err;
    }
};

export const worker = new Worker('message-processing', async job => {
    const start = Date.now();
    const { payload, tenant } = job.data;
    if (!tenant) return;

    const msgs = extractMessages(payload);
    for (const m of msgs) {
        await saveMessage(m, tenant);

        // Process with WhatsApp Agent (bot)
        if (tenant.activo && m.message.type === 'text') {
            const rawMessage = {
                from: m.message.from,
                id: m.message.id,
                text: m.message.text,
                body: m.message.text?.body,
                contact_name: m.contact?.profile?.name || null
            };
            await whatsappAgent.process(rawMessage, tenant);
        }
    }

    const duration = Date.now() - start;
    logger.info('Job completed', { jobId: job.id, messageCount: msgs.length, duration });
}, {
    connection: { url: config.redis.url },
    concurrency: 5
});

worker.on('completed', (job) => {
    logger.info('Worker job completed', { jobId: job.id });
});

worker.on('failed', (job, err) => {
    logger.error('Worker job failed', { jobId: job?.id, error: err.message, attempts: job?.attemptsMade });
});

worker.on('error', err => {
    logger.error('Worker error', { error: err.message });
});
