import { logger } from '../config/logger.js';

export const errorHandler = (err, req, res, next) => {
    logger.error('Express error', { error: err.message, stack: err.stack, path: req.path });

    const statusCode = err.status || 500;

    if (process.env.NODE_ENV === 'production') {
        res.status(statusCode).json({
            error: err.isOperational ? err.message : 'Internal server error',
            code: err.code || 'INTERNAL_ERROR'
        });
    } else {
        res.status(statusCode).json({
            error: err.message,
            code: err.code,
            stack: err.stack
        });
    }
};

export default errorHandler;
