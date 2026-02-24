import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { logger } from '../config/logger.js';
import { sendTextMessage } from '../whatsapp/sender.js';
import config from '../config/index.js';
import { fillTemplate } from '../whatsapp/templates.js';
import { sendTelegramMessage, answerCallbackQuery } from './telegram.js';
import { invalidateHistoryCache } from '../bot/contextBuilder.js';

export const handleTelegramUpdate = async (update) => {
    try {
        if (update.callback_query) {
            return await handleCallbackQuery(update.callback_query);
        }

        if (update.message && update.message.text) {
            return await handleMessage(update.message);
        }
    } catch (err) {
        logger.error('handleTelegramUpdate error', { error: err.message, stack: err.stack });
    }
};

const handleCallbackQuery = async (query) => {
    const chatId = query.from.id.toString();
    const data = query.data;
    const botToken = await getBotTokenForChat(chatId);
    if (!botToken) return;

    if (data.startsWith('tomar_')) {
        const convId = data.replace('tomar_', '');
        await takeConversation(convId, chatId, botToken);
        await answerCallbackQuery(botToken, query.id, '✅ Tomaste el control');
    } else if (data.startsWith('bot_')) {
        const convId = data.replace('bot_', '');
        await returnToBot(convId, chatId, botToken);
        await answerCallbackQuery(botToken, query.id, '🤖 Bot retomó');
    }
};

const handleMessage = async (message) => {
    const chatId = message.from.id.toString();
    const text = message.text?.trim();
    const botToken = await getBotTokenForChat(chatId);
    if (!botToken) return;

    if (text.startsWith('/tomar')) {
        const tenant = await getTenantByChat(chatId);
        if (!tenant) return await sendTelegramMessage(botToken, chatId, '⚠️ No se encontró tenant vinculado.');
        const conv = await getActiveConversation(tenant.id);
        if (!conv) return await sendTelegramMessage(botToken, chatId, '⚠️ No hay conversaciones pendientes.');
        await takeConversation(conv.id, chatId, botToken);
    } else if (text === '/bot') {
        const tenant = await getTenantByChat(chatId);
        if (!tenant) return;
        const conv = await getActiveConversation(tenant.id, 'HUMANO');
        if (!conv) return await sendTelegramMessage(botToken, chatId, '⚠️ No hay conversación en modo humano.');
        await returnToBot(conv.id, chatId, botToken);
    } else if (text === '/cerrar') {
        const tenant = await getTenantByChat(chatId);
        if (!tenant) return;
        const conv = await getActiveConversation(tenant.id, 'HUMANO');
        if (!conv) return await sendTelegramMessage(botToken, chatId, '⚠️ No hay conversación activa.');
        await closeConversation(conv.id, chatId, botToken);
    } else if (!text.startsWith('/')) {
        // Normal message: forward to WhatsApp client
        await forwardToWhatsApp(chatId, text, botToken);
    }
};

const takeConversation = async (convId, chatId, botToken) => {
    await prisma.conversacion.update({
        where: { id: convId },
        data: { estado: 'HUMANO', handover_at: new Date() }
    });
    // Store active conversation for this chat
    await redis.setex(`telegram:active:${chatId}`, 86400, convId);
    await sendTelegramMessage(botToken, chatId, '✅ Tomaste el control. Escribe aquí para responderle al cliente.');
};

const returnToBot = async (convId, chatId, botToken) => {
    await prisma.conversacion.update({
        where: { id: convId },
        data: {
            estado: 'BOT',
            handover_resolved_at: new Date(),
            handover_resolution: 'bot'
        }
    });
    await redis.del(`telegram:active:${chatId}`);
    await redis.del(`handover:${convId}`);

    // Remove from cola_espera
    await prisma.colaEspera.deleteMany({ where: { conversacion_id: convId } });

    await sendTelegramMessage(botToken, chatId, '🤖 Bot retomó la conversación.');
};

const closeConversation = async (convId, chatId, botToken) => {
    await prisma.conversacion.update({
        where: { id: convId },
        data: {
            estado: 'CERRADA',
            handover_resolved_at: new Date(),
            handover_resolution: 'cerrado'
        }
    });
    await redis.del(`telegram:active:${chatId}`);
    await redis.del(`handover:${convId}`);
    await prisma.colaEspera.deleteMany({ where: { conversacion_id: convId } });

    await sendTelegramMessage(botToken, chatId, '✅ Conversación cerrada.');
};

const forwardToWhatsApp = async (chatId, text, botToken) => {
    const convId = await redis.get(`telegram:active:${chatId}`);
    if (!convId) {
        await sendTelegramMessage(botToken, chatId, '⚠️ No hay conversación activa. Usa /tomar primero.');
        return;
    }

    const conv = await prisma.conversacion.findUnique({
        where: { id: convId },
        include: { tenant: true }
    });

    if (!conv || conv.estado !== 'HUMANO') {
        await sendTelegramMessage(botToken, chatId, '⚠️ La conversación ya no está en modo humano.');
        return;
    }

    const result = await sendTextMessage(conv.whatsapp_contact, text, conv.tenant.whatsapp_phone_id, config.whatsapp.token);

    await prisma.mensaje.create({
        data: {
            conversacion_id: conv.id,
            tenant_id: conv.tenant_id,
            whatsapp_message_id: result.messageId || `tg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            direccion: 'SALIENTE',
            tipo: 'TEXTO',
            contenido: text,
            created_at: new Date()
        }
    });

    await invalidateHistoryCache(conv.id);
    await prisma.conversacion.update({
        where: { id: conv.id },
        data: { ultimo_mensaje_at: new Date() }
    });

    await sendTelegramMessage(botToken, chatId, '✅ Mensaje enviado al cliente.');
};

const getTenantByChat = async (chatId) => {
    return await prisma.tenant.findFirst({
        where: { telegram_chat_id: chatId }
    });
};

const getActiveConversation = async (tenantId, estado = null) => {
    const where = { tenant_id: tenantId };
    if (estado) {
        where.estado = estado;
    } else {
        where.estado = { in: ['BOT', 'HUMANO'] };
    }
    return await prisma.conversacion.findFirst({
        where,
        orderBy: { ultimo_mensaje_at: 'desc' }
    });
};

const getBotTokenForChat = async (chatId) => {
    const tenant = await getTenantByChat(chatId);
    if (tenant && tenant.telegram_bot_token) return tenant.telegram_bot_token;
    return process.env.TELEGRAM_BOT_TOKEN || null;
};
