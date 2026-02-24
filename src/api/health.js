import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkgPath = join(__dirname, '../../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

export const healthRouter = Router();

healthRouter.get('/health', async (req, res) => {
    let dbStatus = 'error';
    let redisStatus = 'error';
    let overallStatus = 'ok';

    try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
    } catch (err) {
        overallStatus = 'degraded';
    }

    try {
        const ping = await redis.ping();
        if (ping === 'PONG') redisStatus = 'connected';
    } catch (err) {
        overallStatus = 'degraded';
    }

    const response = {
        status: overallStatus,
        db: dbStatus,
        redis: redisStatus,
        version: pkg.version,
        uptime: process.uptime()
    };

    if (overallStatus === 'degraded') {
        return res.status(503).json(response);
    }

    return res.status(200).json(response);
});
