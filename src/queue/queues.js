import { Queue } from 'bullmq';
import config from '../config/index.js';
import { logger } from '../config/logger.js';

const connection = { url: config.redis.url };

export const messageQueue = new Queue('message-processing', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: false
    }
});

export const notificationQueue = new Queue('notifications', {
    connection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'fixed', delay: 2000 },
        removeOnComplete: { count: 500 }
    }
});

export const handoverQueue = new Queue('handover', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 }
    }
});

export const deadLetterQueue = new Queue('dead-letter', {
    connection,
    defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false
    }
});

// DLQ listener — when a message job exhausts all retries, move to dead letter
messageQueue.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= job.opts.attempts) {
        try {
            await deadLetterQueue.add('dead-message', {
                originalJob: job.data,
                error: err.message,
                failedAt: new Date().toISOString(),
                attempts: job.attemptsMade
            });
            logger.error('Message moved to dead letter queue', { jobId: job.id, error: err.message });
        } catch (dlqErr) {
            logger.error('Failed to move to DLQ', { jobId: job.id, error: dlqErr.message });
        }
    }
});
