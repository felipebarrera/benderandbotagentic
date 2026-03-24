import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { whatsappAgent } from '../../bot/agent.js';
import { extractMessages, saveMessage } from '../../webhook/processor.js';
import { captacionQueue } from '../queues.js';
import { prisma } from '../../db/prisma.js';

export const messageWorker = new Worker('message-processing', async job => {
    const start = Date.now();
    const { payload, tenant } = job.data;
    const msgs = extractMessages(payload);

    if (!tenant) {
        // Sin tenant configurado — ruta a captación directamente
        for (const m of msgs) {
            if (m.message.type === 'text') {
                await captacionQueue.add('prospecto', {
                    canal: 'whatsapp',
                    userId: m.message.from,
                    texto: m.message.text.body,
                    metadata: {
                        contactName: m.contact?.profile?.name || null,
                        messageId: m.message.id
                    }
                });
                logger.info('Sin tenant — mensaje enrutado a captación', { from: m.message.from });
            }
        }
        const duration = Date.now() - start;
        logger.info('Message job completed', { jobId: job.id, messageCount: msgs.length, duration });
        return;
    }

    for (const m of msgs) {
        if (m.message.type !== 'text') {
            // Mensajes no-texto: guardar en conversación si existe, ignorar si no
            const convExistente = await prisma.conversacion.findFirst({
                where: {
                    tenant_id: tenant.id,
                    whatsapp_contact: m.message.from,
                    estado: { in: ['BOT', 'HUMANO'] }
                }
            });
            if (convExistente) {
                await saveMessage(m, tenant);
            }
            continue;
        }

        const from = m.message.from;

        // ¿Este número ya tiene conversación activa con el tenant?
        const convExistente = await prisma.conversacion.findFirst({
            where: {
                tenant_id: tenant.id,
                whatsapp_contact: from,
                estado: { in: ['BOT', 'HUMANO'] }
            },
            orderBy: { created_at: 'desc' }
        });

        // ¿Ya existe como prospecto en captación?
        const prospectoExistente = await prisma.prospecto.findFirst({
            where: { canal: 'whatsapp', canalId: from }
        });

        if (!convExistente && !prospectoExistente) {
            // Número nuevo — va a captación
            await captacionQueue.add('prospecto', {
                canal: 'whatsapp',
                userId: from,
                texto: m.message.text.body,
                metadata: {
                    contactName: m.contact?.profile?.name || null,
                    messageId: m.message.id
                }
            });
            logger.info('Número nuevo — enrutado a captacionQueue', { from });
            continue;
        }

        if (prospectoExistente && prospectoExistente.estado !== 'convertido') {
            // Prospecto en curso — continuar flujo de captación
            await captacionQueue.add('prospecto', {
                canal: 'whatsapp',
                userId: from,
                texto: m.message.text.body,
                metadata: {
                    contactName: m.contact?.profile?.name || null,
                    messageId: m.message.id
                }
            });
            logger.info('Prospecto en curso — continuando captación', { from, estado: prospectoExistente.estado });
            continue;
        }

        // Cliente conocido (con conversación activa o prospecto convertido) — flujo de servicio
        await saveMessage(m, tenant);

        if (tenant.activo) {
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