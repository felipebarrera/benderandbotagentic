import { logger } from '../config/logger.js';
import config from '../config/index.js';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export const sendTelegramMessage = async (botToken, chatId, text, replyMarkup = null) => {
    const url = `${TELEGRAM_API}${botToken}/sendMessage`;

    try {
        const body = {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
        };

        if (replyMarkup) {
            body.reply_markup = replyMarkup;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000)
        });

        const data = await res.json();

        if (res.ok) {
            logger.info('Telegram message sent', { chatId, ok: data.ok });
        } else {
            logger.error('Telegram API error', { chatId, error: data.description });
        }

        return data;
    } catch (err) {
        logger.error('sendTelegramMessage failed', { chatId, error: err.message });
        return null;
    }
};

export const sendHandoverAlert = async (botToken, chatId, tenant, conversacion, mensaje) => {
    const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    const text = `🔔 <b>Nuevo mensaje — ${tenant.nombre}</b>\n\n` +
        `👤 Cliente: ${conversacion.whatsapp_contact}\n` +
        `${conversacion.contact_name ? `📛 Nombre: ${conversacion.contact_name}\n` : ''}` +
        `💬 Mensaje: ${mensaje}\n` +
        `🕐 ${hora}\n\n` +
        `Responde aquí para contestarle directamente.\n` +
        `Comandos: /tomar /bot /cerrar`;

    const replyMarkup = {
        inline_keyboard: [
            [
                { text: '📞 Tomar conversación', callback_data: `tomar_${conversacion.id}` },
                { text: '🤖 Dejar al bot', callback_data: `bot_${conversacion.id}` }
            ]
        ]
    };

    return await sendTelegramMessage(botToken, chatId, text, replyMarkup);
};

export const sendTimeoutAlert = async (botToken, chatId, tenant, conversacion) => {
    const text = `⏰ <b>Tiempo de respuesta agotado</b>\n` +
        `El bot ha retomado la conversación con ${conversacion.whatsapp_contact}\n` +
        `en ${tenant.nombre}.`;

    return await sendTelegramMessage(botToken, chatId, text);
};

export const answerCallbackQuery = async (botToken, callbackQueryId, text = '') => {
    const url = `${TELEGRAM_API}${botToken}/answerCallbackQuery`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
            signal: AbortSignal.timeout(5000)
        });
    } catch (err) {
        logger.warn('answerCallbackQuery failed', { error: err.message });
    }
};
