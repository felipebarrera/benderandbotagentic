import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { sendTextMessage } from '../whatsapp/sender.js';
import config from '../config/index.js';

export const tenantsRouter = Router();
tenantsRouter.use(authMiddleware);
tenantsRouter.use(adminOnly);

tenantsRouter.get('/tenants/me', async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: {
            id: true, nombre: true, whatsapp_number: true, modo_bot: true,
            prompt_personalizado: true, horario_inicio: true, horario_fin: true,
            activo: true, telegram_chat_id: true, created_at: true, updated_at: true
        }
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
    res.json(tenant);
});

tenantsRouter.patch('/tenants/me', async (req, res) => {
    const { nombre, prompt_personalizado, horario_inicio, horario_fin, modo_bot, telegram_chat_id } = req.body;
    const data = {};

    if (nombre !== undefined) data.nombre = nombre;
    if (prompt_personalizado !== undefined) data.prompt_personalizado = prompt_personalizado;
    if (horario_inicio !== undefined) data.horario_inicio = horario_inicio;
    if (horario_fin !== undefined) data.horario_fin = horario_fin;
    if (modo_bot !== undefined) data.modo_bot = modo_bot;
    if (telegram_chat_id !== undefined) data.telegram_chat_id = telegram_chat_id;

    const tenant = await prisma.tenant.update({ where: { id: req.tenantId }, data });

    // Invalidate tenant caches
    await redis.del(`tenant:phone:${tenant.whatsapp_number}`);
    await redis.del(`prompt:system:${tenant.id}`);

    res.json(tenant);
});

tenantsRouter.post('/tenants/me/test-bot', async (req, res) => {
    const { mensaje } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'mensaje requerido' });

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    const result = await sendTextMessage(tenant.whatsapp_number, mensaje, tenant.whatsapp_phone_id, config.whatsapp.token);

    res.json({ enviado: result.success, error: result.error || null });
});
