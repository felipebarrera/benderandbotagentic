import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import config from '../config/index.js';
import { logger } from '../config/logger.js';

export const botConfigRouter = Router();

// Middleware: valida X-Bot-Token para llamadas desde Laravel ERP
const erpAuth = (req, res, next) => {
    const token = req.headers['x-bot-token'];
    if (token !== config.api.internalSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

/**
 * GET /api/bot/status
 * Estado real del bot — llamado desde ConfigBotController de Laravel
 */
botConfigRouter.get('/bot/status', erpAuth, async (req, res) => {
    try {
        const [totalConversaciones, conversacionesActivas, mensajesToday] = await Promise.all([
            prisma.conversacion.count(),
            prisma.conversacion.count({ where: { estado: 'BOT' } }),
            prisma.mensaje.count({
                where: {
                    created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            }),
        ]);

        const redisOk = await redis.ping().then(p => p === 'PONG').catch(() => false);

        return res.json({
            status:                 'online',
            version:                process.env.npm_package_version || '1.0.0',
            uptime:                 Math.floor(process.uptime()),
            llm_provider:           config.llm.provider,
            llm_model:              config.llm.model,
            total_conversaciones:   totalConversaciones,
            conversaciones_activas: conversacionesActivas,
            mensajes_hoy:           mensajesToday,
            redis:                  redisOk ? 'connected' : 'error',
        });
    } catch (err) {
        logger.error('bot/status error', { error: err.message });
        return res.status(503).json({ status: 'error', error: err.message });
    }
});

/**
 * GET /api/bot/logs?limit=20
 * Últimos mensajes reales del bot — llamado desde Laravel para la UI de logs
 */
botConfigRouter.get('/bot/logs', erpAuth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    try {
        const mensajes = await prisma.mensaje.findMany({
            take:    limit,
            orderBy: { created_at: 'desc' },
            select: {
                id:          true,
                direccion:   true,
                tipo:        true,
                contenido:   true,
                created_at:  true,
                conversacion: {
                    select: {
                        whatsapp_contact: true,
                        estado:           true,
                        tenant: { select: { nombre: true } }
                    }
                }
            }
        });

        const logs = mensajes.map(m => ({
            id:        m.id,
            timestamp: m.created_at,
            evento:    m.direccion === 'ENTRANTE'
                         ? `Mensaje recibido: "${m.contenido?.slice(0, 60)}${m.contenido?.length > 60 ? '...' : ''}"`
                         : `Respuesta enviada: "${m.contenido?.slice(0, 60)}${m.contenido?.length > 60 ? '...' : ''}"`,
            direccion: m.direccion === 'ENTRANTE' ? 'IN' : 'OUT',
            estado:    m.conversacion?.estado || 'BOT',
            contacto:  m.conversacion?.whatsapp_contact,
            tenant:    m.conversacion?.tenant?.nombre,
        }));

        return res.json({ logs, total: logs.length });
    } catch (err) {
        logger.error('bot/logs error', { error: err.message });
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/bot/config
 * Configuración LLM actual — para mostrar en la UI de BenderAnd
 */
botConfigRouter.get('/bot/config', erpAuth, async (req, res) => {
    return res.json({
        llm_provider:    config.llm.provider,
        llm_model:       config.llm.model,
        llm_base_url:    config.llm.baseURL,
        llm_temperature: config.llm.temperature,
        llm_max_tokens:  config.llm.maxTokens,
    });
});