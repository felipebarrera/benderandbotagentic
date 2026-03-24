import config from '../src/config/index.js';
import logger from '../src/config/logger.js';
import { prisma } from '../src/db/prisma.js';
import { redis } from '../src/db/redis.js';

// Import all workers
import { messageWorker } from '../src/queue/workers/messageWorker.js';
import { notificationWorker } from '../src/queue/workers/notificationWorker.js';
import { handoverWorker } from '../src/queue/workers/handoverWorker.js';
import { captacionWorker } from '../src/queue/workers/captacionWorker.js';

logger.info('🔄 Workers iniciados: message, notification, handover, captacion');

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Worker shutting down gracefully.');
    await messageWorker.close();
    await notificationWorker.close();
    await handoverWorker.close();
    await captacionWorker.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
});
