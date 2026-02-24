import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import config from '../config/index.js';
import { Worker } from 'bullmq';

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
    } else {
        await prisma.conversacion.update({
            where: { id: conversacion.id },
            data: {
                ultimo_mensaje_at: timestamp,
                ...(name && !conversacion.contact_name ? { contact_name: name } : {})
            }
        });
    }

    try {
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
    const { payload, tenant } = job.data;
    if (!tenant) return;

    const msgs = extractMessages(payload);
    for (const m of msgs) {
        await saveMessage(m, tenant);
    }
}, { connection: { url: config.redis.url } });

worker.on('error', err => {
    logger.error('Worker error', { error: err.message });
});
