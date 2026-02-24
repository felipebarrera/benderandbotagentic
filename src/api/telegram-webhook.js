import { Router } from 'express';
import { handleTelegramUpdate } from '../notifications/commandHandler.js';
import { logger } from '../config/logger.js';

export const telegramWebhookRouter = Router();

telegramWebhookRouter.post('/telegram/webhook', async (req, res) => {
    // Respond 200 immediately as Telegram requires fast responses
    res.sendStatus(200);

    try {
        // Verify secret token if configured
        const secretToken = req.headers['x-telegram-bot-api-secret-token'];
        if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
            logger.warn('Telegram webhook: invalid secret token');
            return;
        }

        const update = req.body;
        logger.info('Telegram update received', { updateId: update.update_id });

        await handleTelegramUpdate(update);
    } catch (err) {
        logger.error('Telegram webhook processing error', { error: err.message });
    }
});
