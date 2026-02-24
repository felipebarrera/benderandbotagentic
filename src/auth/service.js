import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './jwt.js';
import { logger } from '../config/logger.js';

export const login = async (email, password) => {
    const agente = await prisma.agente.findUnique({
        where: { email },
        include: { tenant: { select: { id: true, nombre: true, activo: true } } }
    });

    if (!agente) throw new Error('Credenciales inválidas');

    const valid = await bcrypt.compare(password, agente.password_hash);
    if (!valid) throw new Error('Credenciales inválidas');

    const payload = { agentId: agente.id, tenantId: agente.tenant_id, email: agente.email, rol: agente.rol };
    const accessToken = generateAccessToken(payload);
    const { token: refreshToken, tokenId } = generateRefreshToken(payload);

    await redis.setex(`refresh:${agente.id}:${tokenId}`, 7 * 24 * 3600, refreshToken);

    await prisma.agente.update({ where: { id: agente.id }, data: { ultimo_ping: new Date() } });

    logger.info('Agent logged in', { agentId: agente.id, email });

    return {
        accessToken,
        refreshToken,
        user: { id: agente.id, email: agente.email, nombre: agente.nombre, rol: agente.rol, tenantId: agente.tenant_id }
    };
};

export const refresh = async (refreshToken) => {
    const decoded = verifyRefreshToken(refreshToken);
    const stored = await redis.get(`refresh:${decoded.agentId}:${decoded.tokenId}`);
    if (!stored) throw new Error('Refresh token revocado');

    const payload = { agentId: decoded.agentId, tenantId: decoded.tenantId, email: decoded.email, rol: decoded.rol };
    const newAccessToken = generateAccessToken(payload);
    const { token: newRefreshToken, tokenId: newTokenId } = generateRefreshToken(payload);

    await redis.del(`refresh:${decoded.agentId}:${decoded.tokenId}`);
    await redis.setex(`refresh:${decoded.agentId}:${newTokenId}`, 7 * 24 * 3600, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const logout = async (agentId, refreshToken) => {
    try {
        const decoded = verifyRefreshToken(refreshToken);
        await redis.del(`refresh:${agentId}:${decoded.tokenId}`);
    } catch {
        // Token already invalid, no-op
    }
};

export const logoutAll = async (agentId) => {
    const keys = await redis.keys(`refresh:${agentId}:*`);
    if (keys.length > 0) await redis.del(...keys);
};
