import config from './config/index.js';
import logger from './config/logger.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiLimiter } from './middleware/rateLimit.js';
import errorHandler from './middleware/errorHandler.js';
import { testModeMiddleware } from './middleware/test-mode.middleware.js';
import { contextExtractorMiddleware } from './middleware/context-extractor.middleware.js';
import prisma from './db/prisma.js';
import redis from './db/redis.js';
import { healthRouter } from './api/health.js';
import { webhookRouter } from './webhook/router.js';
import { telegramWebhookRouter } from './api/telegram-webhook.js';
import { apiRouter } from './api/router.js';
import { handoverRouter } from './api/handover.js';
import { initSocket } from './socket/index.js';
import './webhook/processor.js';
import '../worker/index.js';

const app = express();

// === 1. SECURITY Y CORS PRIMERO ===
app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? ['https://webinc.cl'] : '*'
}));

// === 2. JSON PARSER INMEDIATO ===
app.use(express.json({ limit: '10mb' }));

// === 3. RATE LIMITING PARA APIS PÚBLICAS ===
app.use('/api', apiLimiter);

// === 4. MIDDLEWARE DE TEST MODE (puede ser global) ===
app.use(testModeMiddleware);

// === 5. WEBHOOK ROUTES CON SUS MIDDLEWARES ESPECÍFICOS ===
// contextExtractorMiddleware SOLO aplica a webhooks (WhatsApp/Telegram)
app.use(healthRouter);
app.use('/webhook', contextExtractorMiddleware);
app.use('/webhook', webhookRouter);
app.use('/webhook', telegramWebhookRouter);

// === 6. API ROUTES CENTRALIZADAS (sin context extractor) ===
app.use('/api', apiRouter);
app.use('/api/handover', handoverRouter);

// === 7. ERROR HANDLER AL FINAL ===
app.use(errorHandler);
const server = app.listen(config.api.port, () => {
    logger.info(`🚀 Moteland WA API corriendo en puerto ${config.api.port}`);
});

// Initialize Socket.io with the HTTP server
initSocket(server);

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully.');
    server.close(async () => {
        logger.info('HTTP server closed.');
        await prisma.$disconnect();
        await redis.quit();
        process.exit(0);
    });
});
