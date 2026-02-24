import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { resolveHandover } from '../bot/handover.js';
import { logger } from '../config/logger.js';

export const handoverRouter = Router();

handoverRouter.get('/handover/active', async (req, res) => {
    try {
        const conversaciones = await prisma.conversacion.findMany({
            where: { estado: 'HUMANO' },
            include: {
                tenant: { select: { id: true, nombre: true } },
                agente: { select: { id: true, nombre: true } }
            },
            orderBy: { handover_at: 'desc' }
        });

        const result = conversaciones.map(c => ({
            id: c.id,
            tenant: c.tenant.nombre,
            whatsapp_contact: c.whatsapp_contact,
            contact_name: c.contact_name,
            handover_at: c.handover_at,
            tiempo_espera: c.handover_at ? Math.round((Date.now() - new Date(c.handover_at).getTime()) / 1000) : null,
            agente: c.agente?.nombre || null
        }));

        res.json(result);
    } catch (err) {
        logger.error('handover/active error', { error: err.message });
        res.status(500).json({ error: 'Failed to get active handovers' });
    }
});

handoverRouter.post('/handover/:conversacionId/resolve', async (req, res) => {
    try {
        const { conversacionId } = req.params;
        const { resolucion } = req.body;

        if (!['bot', 'cerrar'].includes(resolucion)) {
            return res.status(400).json({ error: 'resolucion must be "bot" or "cerrar"' });
        }

        const mappedResolution = resolucion === 'bot' ? 'timeout' : 'cerrado';
        await resolveHandover(conversacionId, mappedResolution);

        res.json({ success: true, conversacionId, resolucion });
    } catch (err) {
        logger.error('handover/resolve error', { error: err.message });
        res.status(500).json({ error: 'Failed to resolve handover' });
    }
});
