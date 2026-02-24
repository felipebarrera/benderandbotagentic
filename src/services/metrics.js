import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';

export const getDashboardMetrics = async (tenantId, periodo = 'hoy') => {
    const cacheKey = `metrics:${tenantId}:${periodo}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const desde = getDesde(periodo);

    const [
        convTotal, convBot, convHumano,
        mensajesTotal, colaActual, convActivas
    ] = await Promise.all([
        prisma.conversacion.count({ where: { tenant_id: tenantId, created_at: { gte: desde } } }),
        prisma.conversacion.count({ where: { tenant_id: tenantId, created_at: { gte: desde }, handover_at: null } }),
        prisma.conversacion.count({ where: { tenant_id: tenantId, created_at: { gte: desde }, handover_at: { not: null } } }),
        prisma.mensaje.count({ where: { tenant_id: tenantId, created_at: { gte: desde } } }),
        prisma.colaEspera.count({ where: { tenant_id: tenantId } }),
        prisma.conversacion.count({ where: { tenant_id: tenantId, estado: { in: ['BOT', 'HUMANO'] } } })
    ]);

    const agentKeys = await redis.keys(`agent:online:*`);
    const agentesOnline = agentKeys.length;

    const tasaResolucion = convTotal > 0 ? Math.round((convBot / convTotal) * 100) : 0;

    const metrics = {
        conversaciones_totales: convTotal,
        conversaciones_bot: convBot,
        conversaciones_humano: convHumano,
        tasa_resolucion_bot: tasaResolucion,
        mensajes_totales: mensajesTotal,
        cola_actual: colaActual,
        agentes_online: agentesOnline,
        conversaciones_activas: convActivas,
        periodo
    };

    await redis.setex(cacheKey, 60, JSON.stringify(metrics));
    return metrics;
};

export const getActivity = async (tenantId) => {
    const desde = new Date();
    desde.setHours(desde.getHours() - 24);

    const mensajes = await prisma.mensaje.findMany({
        where: { tenant_id: tenantId, created_at: { gte: desde } },
        select: { direccion: true, created_at: true }
    });

    const horasMap = {};
    for (let i = 0; i < 24; i++) horasMap[i] = { hora: i, entrantes: 0, salientes: 0 };

    for (const m of mensajes) {
        const h = new Date(m.created_at).getHours();
        if (m.direccion === 'ENTRANTE') horasMap[h].entrantes++;
        else horasMap[h].salientes++;
    }

    return Object.values(horasMap);
};

export const getRealtime = async (tenantId) => {
    const [convActivas, colaActual] = await Promise.all([
        prisma.conversacion.count({ where: { tenant_id: tenantId, estado: { in: ['BOT', 'HUMANO'] } } }),
        prisma.colaEspera.count({ where: { tenant_id: tenantId } })
    ]);

    const agentKeys = await redis.keys(`agent:online:*`);

    return {
        conversaciones_activas: convActivas,
        cola_actual: colaActual,
        agentes_online: agentKeys.length
    };
};

const getDesde = (periodo) => {
    const now = new Date();
    if (periodo === 'hoy') {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (periodo === 'semana') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return d;
    } else if (periodo === 'mes') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        return d;
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
