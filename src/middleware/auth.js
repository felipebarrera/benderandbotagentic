import { verifyAccessToken } from '../auth/jwt.js';
import { logger } from '../config/logger.js';

export const authMiddleware = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    const token = header.split(' ')[1];

    try {
        const decoded = verifyAccessToken(token);
        req.agentId = decoded.agentId;
        req.tenantId = decoded.tenantId;
        req.agentRol = decoded.rol;
        next();
    } catch (err) {
        return res.status(401).json({ error: err.message });
    }
};

export const adminOnly = (req, res, next) => {
    if (req.agentRol !== 'ADMIN') {
        return res.status(403).json({ error: 'Se requiere rol ADMIN' });
    }
    next();
};

export default authMiddleware;
