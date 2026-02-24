import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { whatsappAgent } from '../../bot/agent.js';
import { extractMessages, saveMessage } from '../../webhook/processor.js';

export const messageWorker = new Worker('message-processing', async job => {
    const start = Date.now();
    const { payload, tenant } = job.data;

    if (!tenant) {
        logger.warn('Message worker: no tenant in job', { jobId: job.id });
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
    logger.info('Message job completed', { jobId: job.id, messageCount: msgs.length, duration });
}, {
    connection: { url: config.redis.url },
    concurrency: 5
});

messageWorker.on('completed', (job) => {
    logger.info('Message worker job completed', { jobId: job.id });
});

messageWorker.on('failed', (job, err) => {
    logger.error('Message worker job failed', { jobId: job?.id, error: err.message, attempts: job?.attemptsMade });
});
