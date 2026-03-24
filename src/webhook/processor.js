import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

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
        emitToTenant(tenant.id, 'conversation_update', conversacion);

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