import config from '../src/config/index.js';
import logger from '../src/config/logger.js';
import { Worker } from 'bullmq';
import { prisma } from '../src/db/prisma.js';
import { redis } from '../src/db/redis.js';
import { whatsappAgent } from '../src/bot/agent.js';
import { extractMessages, saveMessage } from '../src/webhook/processor.js';

logger.info('🔄 Worker BullMQ iniciado');

const worker = new Worker('message-processing', async job => {
    const start = Date.now();
    const { payload, tenant } = job.data;

    if (!tenant) {
        logger.warn('Job without tenant, skipping', { jobId: job.id });
        return;
    }

    const msgs = extractMessages(payload);

    for (const m of msgs) {
        await saveMessage(m, tenant);

        if (tenant.activo && m.message.type === 'text') {
            const rawMessage = {
                from: m.message.from,
                id: m.message.id,
                text: m.message.text,
                body: m.message.text?.body,
                contact_name: m.contact?.profile?.name || null
            };
            await whatsappAgent.process(rawMessage, tenant);
        }
    }

    const duration = Date.now() - start;
    logger.info('Job completed', { jobId: job.id, messageCount: msgs.length, duration });
}, {
    connection: { url: config.redis.url },
    concurrency: 5
});

worker.on('completed', (job) => {
    logger.info('Worker job completed', { jobId: job.id });
});

worker.on('failed', (job, err) => {
    logger.error('Worker job failed', { jobId: job?.id, error: err.message, attempts: job?.attemptsMade });
});

worker.on('error', err => {
    logger.error('Worker error', { error: err.message });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Worker shutting down gracefully.');
    await worker.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
});
