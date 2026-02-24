import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';
import { notifyHandover, notifyTimeout } from '../../notifications/index.js';

export const notificationWorker = new Worker('notifications', async job => {
    const { tenantId, conversacionId, mensaje } = job.data;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        logger.warn('Notification worker: tenant not found', { tenantId });
        return;
    }

    const conversacion = await prisma.conversacion.findUnique({ where: { id: conversacionId } });
    if (!conversacion) {
        logger.warn('Notification worker: conversation not found', { conversacionId });
        return;
    }

    if (job.name === 'notify-handover') {
        await notifyHandover(tenant, conversacion, mensaje);
        logger.info('Handover notification sent', { tenantId, conversacionId });
    } else if (job.name === 'notify-timeout') {
        await notifyTimeout(tenant, conversacion);
        logger.info('Timeout notification sent', { tenantId, conversacionId });
    }
}, {
    connection: { url: config.redis.url },
    concurrency: 3
});

notificationWorker.on('completed', (job) => {
    logger.info('Notification job completed', { jobId: job.id });
});

notificationWorker.on('failed', (job, err) => {
    logger.error('Notification job failed', { jobId: job?.id, error: err.message });
});
