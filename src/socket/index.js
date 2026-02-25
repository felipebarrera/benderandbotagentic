import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { logger } from '../config/logger.js';

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production' ? ['https://moteland.cl'] : '*',
            methods: ['GET', 'POST']
        }
    });

    // Middleware auth
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication error: Token required'));

        try {
            const decoded = jwt.verify(token, config.api.jwtSecret);
            socket.agentId = decoded.agentId;
            socket.tenantId = decoded.tenantId;
            socket.rol = decoded.rol;
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        logger.info('Cliente Socket.io conectado', { socketId: socket.id, agentId: socket.agentId, tenantId: socket.tenantId });

        // Join room for this tenant to broadcast tenant-specific events
        const tenantRoom = `tenant_${socket.tenantId}`;
        socket.join(tenantRoom);

        socket.on('disconnect', () => {
            logger.info('Cliente Socket.io desconectado', { socketId: socket.id });
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) throw new Error('Socket.io no está inicializado');
    return io;
};

// Funciones helpers para emitir
export const emitToTenant = (tenantId, event, data) => {
    if (io) {
        io.to(`tenant_${tenantId}`).emit(event, data);
    }
};
