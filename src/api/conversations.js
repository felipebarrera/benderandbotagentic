import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendTextMessage } from '../whatsapp/sender.js';
import config from '../config/index.js';
import { logger } from '../config/logger.js';
import { invalidateHistoryCache } from '../bot/contextBuilder.js';
import { emitToTenant } from '../socket/index.js';

export const conversationsRouter = Router();
conversationsRouter.use(authMiddleware);

conversationsRouter.get('/conversations', async (req, res) => {
    const { estado, page = 1, limit = 20, search, desde } = req.query;
    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where = { tenant_id: req.tenantId };

    if (estado && estado !== 'todas') {
        where.estado = estado;
    } else {
        where.estado = { in: ['BOT', 'HUMANO'] };
    }

    if (search) {
        where.OR = [
            { whatsapp_contact: { contains: search } },
            { contact_name: { contains: search, mode: 'insensitive' } }
        ];
    }

    if (desde) {
        where.ultimo_mensaje_at = { gte: new Date(desde) };
    }

    const [data, total] = await Promise.all([
        prisma.conversacion.findMany({
            where,
            include: {
                mensajes: { orderBy: { created_at: 'desc' }, take: 1, select: { contenido: true, direccion: true, created_at: true } },
                agente: { select: { id: true, nombre: true } }
            },
            orderBy: { ultimo_mensaje_at: 'desc' },
            skip,
            take
        }),
        prisma.conversacion.count({ where })
    ]);

    res.json({ data, total, page: parseInt(page) || 1, totalPages: Math.ceil(total / take) });
});

conversationsRouter.get('/conversations/:id', async (req, res) => {
    const conv = await prisma.conversacion.findFirst({
        where: { id: req.params.id, tenant_id: req.tenantId },
        include: {
            mensajes: { orderBy: { created_at: 'desc' }, take: 50 },
            agente: { select: { id: true, nombre: true } },
            tenant: { select: { id: true, nombre: true } }
        }
    });
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
    res.json(conv);
});

conversationsRouter.get('/conversations/:id/messages', async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const take = Math.min(parseInt(limit) || 50, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const conv = await prisma.conversacion.findFirst({
        where: { id: req.params.id, tenant_id: req.tenantId },
        select: { id: true }
    });
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    const [data, total] = await Promise.all([
        prisma.mensaje.findMany({
            where: { conversacion_id: req.params.id },
            orderBy: { created_at: 'desc' },
            skip,
            take
        }),
        prisma.mensaje.count({ where: { conversacion_id: req.params.id } })
    ]);

    res.json({ data, total, page: parseInt(page) || 1, totalPages: Math.ceil(total / take) });
});

conversationsRouter.patch('/conversations/:id', async (req, res) => {
    const { estado, agente_id, contact_name } = req.body;
    const allowedUpdates = {};

    if (estado) allowedUpdates.estado = estado;
    if (agente_id !== undefined) allowedUpdates.agente_id = agente_id;
    if (contact_name) allowedUpdates.contact_name = contact_name;

    const conv = await prisma.conversacion.findFirst({
        where: { id: req.params.id, tenant_id: req.tenantId }
    });
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    const updated = await prisma.conversacion.update({
        where: { id: req.params.id },
        data: allowedUpdates,
        include: { agente: true }
    });

    emitToTenant(req.tenantId, 'conversation_update', updated);

    res.json(updated);
});

conversationsRouter.post('/conversations/:id/messages', async (req, res) => {
    const { contenido } = req.body;
    if (!contenido) return res.status(400).json({ error: 'contenido requerido' });

    const conv = await prisma.conversacion.findFirst({
        where: { id: req.params.id, tenant_id: req.tenantId },
        include: { tenant: true }
    });
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    const result = await sendTextMessage(conv.whatsapp_contact, contenido, conv.tenant.whatsapp_phone_id, config.whatsapp.token);

    const msg = await prisma.mensaje.create({
        data: {
            conversacion_id: conv.id,
            tenant_id: req.tenantId,
            whatsapp_message_id: result.messageId || `dash_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            direccion: 'SALIENTE',
            tipo: 'TEXTO',
            contenido,
            created_at: new Date()
        }
    });

    await invalidateHistoryCache(conv.id);
    const updatedConv = await prisma.conversacion.update({
        where: { id: conv.id },
        data: { ultimo_mensaje_at: new Date() },
        include: { agente: true }
    });

    emitToTenant(req.tenantId, 'new_message', msg);
    emitToTenant(req.tenantId, 'conversation_update', updatedConv);

    res.status(201).json(msg);
});

conversationsRouter.delete('/conversations/:id', authMiddleware, async (req, res) => {
    if (req.agentRol !== 'ADMIN') return res.status(403).json({ error: 'Solo ADMIN' });

    const conv = await prisma.conversacion.findFirst({
        where: { id: req.params.id, tenant_id: req.tenantId }
    });
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    const updatedConv = await prisma.conversacion.update({
        where: { id: req.params.id },
        data: { estado: 'CERRADA' },
        include: { agente: true }
    });

    emitToTenant(req.tenantId, 'conversation_update', updatedConv);
    res.json({ success: true });
});
