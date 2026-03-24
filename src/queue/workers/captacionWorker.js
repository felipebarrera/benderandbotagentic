// src/queue/workers/captacionWorker.js
import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { handleCaptacion } from '../../captacion/handler.js';
import { sendTextMessage, markAsRead } from '../../whatsapp/sender.js';

export const captacionWorker = new Worker('captacion-processing', async job => {
    const start = Date.now();
    const { canal, userId, texto, metadata } = job.data;

    try {
        if (metadata?.messageId) {
            // Marcar como leído
            await markAsRead(metadata.messageId, config.whatsapp.phoneId, config.whatsapp.token);
        }

        // Obtener respuesta del orquestador de captación
        const respuesta = await handleCaptacion(canal, userId, texto, metadata);

        // Enviar respuesta por WhatsApp
        if (respuesta && canal === 'whatsapp') {
            await sendTextMessage(userId, respuesta, config.whatsapp.phoneId, config.whatsapp.token);
            logger.info('Respuesta de captación enviada', { to: userId });
        } else if (canal !== 'whatsapp') {
            // En el futuro, usar adaptador correspondiente (telegram, etc.)
            logger.info('Respuesta generada para canal alternativo', { canal, to: userId });
        }

        const duration = Date.now() - start;
        logger.info('Job captación completado', { jobId: job.id, duration });
    } catch (error) {
        logger.error('Error en captacionWorker', { jobId: job.id, error: error.message, stack: error.stack });
        throw error;
    }
}, {
    connection: { url: config.redis.url },
    concurrency: 2 // Menos concurrencia por ahora ya que llama al LLM frecuentemente
});

captacionWorker.on('completed', (job) => {
    logger.info('Captación worker job completado', { jobId: job.id });
});

captacionWorker.on('failed', (job, err) => {
    logger.error('Captación worker job falló', { jobId: job?.id, error: err.message, attempts: job?.attemptsMade });
});
