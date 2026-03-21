import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, superAdminOnly } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const superadminRouter = Router();

superadminRouter.use(authMiddleware);
superadminRouter.use(superAdminOnly);

// Obtener todos los tenants y sus métricas básicas
superadminRouter.get('/tenants', async (req, res) => {
    try {
        const tenants = await prisma.tenant.findMany({
            include: {
                _count: {
                    select: { conversaciones: true, agentes: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });
        res.json(tenants);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Activar o desactivar tenant
superadminRouter.patch('/tenants/:id/status', async (req, res) => {
    try {
        const { activo } = req.body;
        const tenant = await prisma.tenant.update({
            where: { id: req.params.id },
            data: { activo }
        });
        res.json(tenant);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default superadminRouter;
