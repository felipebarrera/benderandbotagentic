import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authService from '../auth/service.js';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Demasiados intentos de login. Intenta en 1 minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
});

authRouter.post('/auth/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

        const result = await authService.login(email, password);
        res.json(result);
    } catch (err) {
        logger.warn('Login failed', { email: req.body?.email, error: err.message });
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

authRouter.post('/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ error: 'refreshToken requerido' });

        const result = await authService.refresh(refreshToken);
        res.json(result);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

authRouter.post('/auth/logout', authMiddleware, async (req, res) => {
    await authService.logout(req.agentId, req.body.refreshToken);
    res.json({ success: true });
});

authRouter.post('/auth/logout-all', authMiddleware, async (req, res) => {
    await authService.logoutAll(req.agentId);
    res.json({ success: true });
});

authRouter.get('/auth/me', authMiddleware, async (req, res) => {
    const agente = await prisma.agente.findUnique({
        where: { id: req.agentId },
        select: { id: true, email: true, nombre: true, rol: true, tenant_id: true, online: true, created_at: true }
    });
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' });
    res.json(agente);
});
