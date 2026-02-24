import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';

export const getConversationHistory = async (conversacionId, limit = 5) => {
    const cacheKey = `conv:history:${conversacionId}`;

    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const mensajes = await prisma.mensaje.findMany({
        where: { conversacion_id: conversacionId },
        orderBy: { created_at: 'asc' },
        take: limit,
        select: {
            direccion: true,
            contenido: true,
            tipo: true
        }
    });

    const historial = mensajes
        .filter(m => m.tipo === 'TEXTO')
        .map(m => ({
            role: m.direccion === 'ENTRANTE' ? 'user' : 'assistant',
            content: m.contenido
        }));

    await redis.setex(cacheKey, 60, JSON.stringify(historial));
    return historial;
};

export const invalidateHistoryCache = async (conversacionId) => {
    await redis.del(`conv:history:${conversacionId}`);
};

export const buildContext = (intent, entidades, pmsData) => {
    const parts = [];

    if (intent === 'DISPONIBILIDAD' && pmsData) {
        if (pmsData.length > 0) {
            const hab = pmsData.map(h => `${h.tipo || h.nombre}: $${h.precio || h.precio_base}`).join(', ');
            parts.push(`Habitaciones disponibles: ${hab}`);
        } else {
            parts.push('No hay habitaciones disponibles para la fecha solicitada.');
        }
    }

    if (intent === 'PRECIOS' && pmsData) {
        if (pmsData.length > 0) {
            const precios = pmsData.map(p => `${p.tipo || p.nombre}: $${p.precio_base}${p.precio_fin_semana ? ` (fds: $${p.precio_fin_semana})` : ''}`).join(', ');
            parts.push(`Lista de precios: ${precios}`);
        }
    }

    if (entidades.fecha) {
        parts.push(`Fecha consultada: ${entidades.fecha}`);
    }
    if (entidades.personas) {
        parts.push(`Personas: ${entidades.personas}`);
    }

    return parts.length > 0 ? parts.join('\n') : null;
};
