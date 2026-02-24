import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { logoutAll } from '../auth/service.js';
import { logger } from '../config/logger.js';

export const agentsRouter = Router();
agentsRouter.use(authMiddleware);

agentsRouter.get('/agents', async (req, res) => {
    const agentes = await prisma.agente.findMany({
        where: { tenant_id: req.tenantId },
        select: {
            id: true, email: true, nombre: true, rol: true, online: true, ultimo_ping: true, created_at: true,
            _count: { select: { conversaciones: { where: { estado: { in: ['BOT', 'HUMANO'] } } } } }
        }
    });
    res.json(agentes);
});

agentsRouter.get('/agents/:id', async (req, res) => {
    const agente = await prisma.agente.findFirst({
        where: { id: req.params.id, tenant_id: req.tenantId },
        select: {
            id: true, email: true, nombre: true, rol: true, online: true, ultimo_ping: true, created_at: true,
            conversaciones: { where: { estado: { in: ['BOT', 'HUMANO'] } }, select: { id: true, whatsapp_contact: true, estado: true } }
        }
    });
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' });
    res.json(agente);
});

agentsRouter.post('/agents', adminOnly, async (req, res) => {
    const { email, password, nombre, rol } = req.body;
    if (!email || !password || !nombre) return res.status(400).json({ error: 'email, password y nombre requeridos' });

    const existing = await prisma.agente.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email ya registrado' });

    const password_hash = await bcrypt.hash(password, 12);
    const agente = await prisma.agente.create({
        data: { tenant_id: req.tenantId, email, password_hash, nombre, rol: rol || 'AGENTE' },
        select: { id: true, email: true, nombre: true, rol: true, created_at: true }
    });
    res.status(201).json(agente);
});

agentsRouter.patch('/agents/:id', adminOnly, async (req, res) => {
    const { nombre, rol, password_nuevo } = req.body;
    const agente = await prisma.agente.findFirst({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' });

    const data = {};
    if (nombre) data.nombre = nombre;
    if (rol) data.rol = rol;
    if (password_nuevo) {
        data.password_hash = await bcrypt.hash(password_nuevo, 12);
        await logoutAll(agente.id);
    }

    const updated = await prisma.agente.update({
        where: { id: req.params.id },
        data,
        select: { id: true, email: true, nombre: true, rol: true }
    });
    res.json(updated);
});

agentsRouter.delete('/agents/:id', adminOnly, async (req, res) => {
    const agente = await prisma.agente.findFirst({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' });

    const activeConvs = await prisma.conversacion.count({ where: { agente_id: agente.id, estado: 'HUMANO' } });
    if (activeConvs > 0) return res.status(409).json({ error: 'Agente tiene conversaciones activas asignadas' });

    await logoutAll(agente.id);
    await prisma.agente.delete({ where: { id: req.params.id } });
    res.json({ success: true });
});

agentsRouter.patch('/agents/:id/status', async (req, res) => {
    if (req.agentId !== req.params.id) return res.status(403).json({ error: 'Solo puedes actualizar tu propio status' });
    const { online } = req.body;

    if (online) {
        await redis.setex(`agent:online:${req.agentId}`, 90, '1');
    } else {
        await redis.del(`agent:online:${req.agentId}`);
    }

    await prisma.agente.update({ where: { id: req.agentId }, data: { online: !!online, ultimo_ping: new Date() } });
    res.json({ online: !!online });
});
