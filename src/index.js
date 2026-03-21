import config from './config/index.js';
import logger from './config/logger.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiLimiter } from './middleware/rateLimit.js';
import errorHandler from './middleware/errorHandler.js';
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

app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? ['https://moteland.cl'] : '*'
}));

// Webhook routes (before JSON body parser for HMAC)
app.use(healthRouter);
app.use('/webhook', webhookRouter);

// JSON body parser
app.use(express.json({ limit: '10mb' }));
app.use(telegramWebhookRouter);

// API routes (centralized router)
app.use('/api', apiLimiter);
app.use('/api', apiRouter);

// Error handler
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
