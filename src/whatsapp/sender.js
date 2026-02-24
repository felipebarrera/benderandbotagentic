import config from '../config/index.js';
import { logger } from '../config/logger.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

export const sendTextMessage = async (to, text, phoneId, token) => {
    const url = `${GRAPH_API_BASE}/${phoneId}/messages`;
    const start = Date.now();

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text }
            }),
            signal: AbortSignal.timeout(10000)
        });

        const data = await res.json();
        const duration = Date.now() - start;

        if (res.ok) {
            logger.info('Message sent to WhatsApp', { to, duration, messageId: data.messages?.[0]?.id });
            return { success: true, messageId: data.messages?.[0]?.id, error: null };
        } else {
            logger.error('WhatsApp API error', { to, status: res.status, data, duration });
            return { success: false, messageId: null, error: data.error?.message || 'Unknown error' };
        }
    } catch (err) {
        const duration = Date.now() - start;
        logger.error('sendTextMessage failed', { to, text: text.substring(0, 20), error: err.message, duration });
        return { success: false, messageId: null, error: err.message };
    }
};

export const markAsRead = async (messageId, phoneId, token) => {
    const url = `${GRAPH_API_BASE}/${phoneId}/messages`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            }),
            signal: AbortSignal.timeout(5000)
        });
    } catch (err) {
        logger.warn('markAsRead failed (best effort)', { messageId, error: err.message });
    }
};

export const sendTypingIndicator = async (to, phoneId, token) => {
    // WhatsApp Cloud API does not have a native typing indicator.
    // We mark the latest message as read (blue ticks) as the closest equivalent.
};
