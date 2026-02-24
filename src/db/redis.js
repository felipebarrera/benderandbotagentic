import { Redis } from 'ioredis';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';

export const redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

redis.on('error', (err) => {
    logger.error('Redis connection error', { error: err.message, stack: err.stack });
});

redis.on('connect', () => {
    logger.info('Connected to Redis');
});

export default redis;
