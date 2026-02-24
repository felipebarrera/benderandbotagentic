import { logger } from '../config/logger.js';
import { sendHandoverAlert, sendTimeoutAlert, sendTelegramMessage } from './telegram.js';

export { sendTelegramMessage, sendHandoverAlert, sendTimeoutAlert, answerCallbackQuery } from './telegram.js';

export const notifyHandover = async (tenant, conversacion, mensaje) => {
    if (!tenant.telegram_chat_id) {
        logger.warn('Tenant has no Telegram chat_id configured', { tenantId: tenant.id });
        return;
    }

    const botToken = tenant.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        logger.warn('No Telegram bot token available', { tenantId: tenant.id });
        return;
    }

    await sendHandoverAlert(botToken, tenant.telegram_chat_id, tenant, conversacion, mensaje);
};

export const notifyTimeout = async (tenant, conversacion) => {
    if (!tenant.telegram_chat_id) return;

    const botToken = tenant.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    await sendTimeoutAlert(botToken, tenant.telegram_chat_id, tenant, conversacion);
};
