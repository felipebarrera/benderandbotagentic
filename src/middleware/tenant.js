import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { logger } from '../config/logger.js';

export const resolveTenant = async (req, res, next) => {
    try {
        // req.body is already parsed here because express.json() runs after raw verification
        const body = req.body;
        let phoneNumber = null;

        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0].value &&
            body.entry[0].changes[0].value.metadata
        ) {
            phoneNumber = body.entry[0].changes[0].value.metadata.display_phone_number;
        }

        if (!phoneNumber) {
            return next();
        }

        const cacheKey = `tenant:phone:${phoneNumber}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            req.tenant = JSON.parse(cached);
            req.tenantId = req.tenant.id;
            return next();
        }

        const tenant = await prisma.tenant.findUnique({
            where: { whatsapp_number: phoneNumber }
        });

        if (!tenant) {
            logger.warn(`Mensaje de webhook ignorado: No tenant found for ${phoneNumber}`);
            return next();
        }

        await redis.setex(cacheKey, 300, JSON.stringify(tenant));

        req.tenant = tenant;
        req.tenantId = tenant.id;
        next();
    } catch (err) {
        logger.error('Error resolving tenant', { error: err.message, stack: err.stack });
        next();
    }
};
