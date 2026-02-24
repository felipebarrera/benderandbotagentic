import { messageQueue, notificationQueue, handoverQueue, deadLetterQueue } from './queues.js';
import { JOB_NAMES } from './jobs.js';
import { logger } from '../config/logger.js';

export { messageQueue, notificationQueue, handoverQueue, deadLetterQueue } from './queues.js';
export { JOB_NAMES } from './jobs.js';

export const addMessageJob = async (data) => {
    const hora = new Date().getHours();
    const isNight = hora >= 22 || hora < 8;
    const priority = isNight ? 1 : 5;

    return await messageQueue.add(JOB_NAMES.PROCESS_MESSAGE, data, { priority });
};

export const addNotificationJob = async (data) => {
    return await notificationQueue.add(JOB_NAMES.NOTIFY_HANDOVER, data);
};

export const addHandoverJob = async (data, delay = 5 * 60 * 1000) => {
    return await handoverQueue.add(JOB_NAMES.HANDOVER_TIMEOUT_CHECK, data, { delay });
};

export const getQueueStats = async () => {
    const [msgCounts, notifCounts, handoverCounts, dlqCounts] = await Promise.all([
        messageQueue.getJobCounts(),
        notificationQueue.getJobCounts(),
        handoverQueue.getJobCounts(),
        deadLetterQueue.getJobCounts()
    ]);

    return {
        message: msgCounts,
        notification: notifCounts,
        handover: handoverCounts,
        deadLetter: dlqCounts
    };
};
