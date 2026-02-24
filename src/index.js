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
import { queueRouter } from './api/queue.js';
import { handoverRouter } from './api/handover.js';
import './webhook/processor.js';

const app = express();

app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? ['https://moteland.cl'] : '*'
}));

app.use(healthRouter);
app.use('/webhook', webhookRouter);

app.use(express.json({ limit: '10mb' }));

app.use('/api', telegramWebhookRouter);
app.use('/api', queueRouter);
app.use('/api', handoverRouter);
app.use('/api', apiLimiter);

app.use(errorHandler);

const server = app.listen(config.api.port, () => {
    logger.info(`🚀 Moteland WA API corriendo en puerto ${config.api.port}`);
});

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully.');
    server.close(async () => {
        logger.info('HTTP server closed.');
        await prisma.$disconnect();
        await redis.quit();
        process.exit(0);
    });
});
