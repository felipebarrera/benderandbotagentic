import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';
import { resolveHandover } from '../../bot/handover.js';

export const handoverWorker = new Worker('handover', async job => {
    if (job.name !== 'handover-timeout-check') return;

    const { conversacionId, tenantId } = job.data;

    // Check if handover is still active
    const handoverKey = await redis.get(`handover:${conversacionId}`);
    if (!handoverKey) {
        logger.info('Handover already resolved, skipping timeout', { conversacionId });
        return;
    }

    // Check if conversation is still in HUMANO state
    const conv = await prisma.conversacion.findUnique({
        where: { id: conversacionId },
        select: { estado: true }
    });

    if (!conv || conv.estado !== 'HUMANO') {
        logger.info('Conversation no longer in HUMANO state, skipping timeout', { conversacionId });
        return;
    }

    // Timeout: no response from owner, return to bot
    await resolveHandover(conversacionId, 'timeout');
    logger.info('Handover timeout triggered', { conversacionId, tenantId });
}, {
    connection: { url: config.redis.url },
    concurrency: 2
});

handoverWorker.on('completed', (job) => {
    logger.info('Handover job completed', { jobId: job.id });
});

handoverWorker.on('failed', (job, err) => {
    logger.error('Handover job failed', { jobId: job?.id, error: err.message });
});
