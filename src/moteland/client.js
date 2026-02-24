import { logger } from '../config/logger.js';
import config from '../config/index.js';
import { redis } from '../db/redis.js';

class MotelandClient {
    constructor() {
        this.baseURL = config.moteland.apiUrl;
        this.secret = config.api.internalSecret;
        this.timeout = 5000;
    }

    async _fetch(path, options = {}) {
        const url = `${this.baseURL}${path}`;
        const start = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const res = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': this.secret,
                    ...(options.headers || {})
                }
            });

            clearTimeout(timeoutId);
            const duration = Date.now() - start;
            logger.info('PMS request', { url: path, status: res.status, duration });

            if (!res.ok) {
                throw new Error(`PMS responded with status ${res.status}`);
            }

            return await res.json();
        } catch (err) {
            clearTimeout(timeoutId);
            logger.error('PMS request failed', { url: path, error: err.message });
            throw err;
        }
    }

    async _fetchWithRetry(path, options = {}, retries = 2, delay = 500) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await this._fetch(path, options);
            } catch (err) {
                if (attempt === retries) throw err;
                logger.warn(`PMS retry ${attempt + 1}/${retries}`, { path });
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    async getDisponibilidad(tenantId, fecha, personas) {
        try {
            const params = new URLSearchParams({ tenantId, fecha });
            if (personas) params.append('personas', personas);
            return await this._fetchWithRetry(`/api/habitaciones/disponibles?${params}`);
        } catch (err) {
            logger.error('getDisponibilidad failed', { tenantId, fecha, personas, error: err.message });
            return [];
        }
    }

    async getPrecios(tenantId) {
        const cacheKey = `pms:precios:${tenantId}`;
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);

            const precios = await this._fetchWithRetry(`/api/habitaciones/precios?tenantId=${tenantId}`);
            await redis.setex(cacheKey, 600, JSON.stringify(precios));
            return precios;
        } catch (err) {
            logger.error('getPrecios failed', { tenantId, error: err.message });
            return [];
        }
    }

    async crearReservaSimple(tenantId, datos) {
        return await this._fetch('/api/reservas/simple', {
            method: 'POST',
            body: JSON.stringify({ tenantId, ...datos })
        });
    }

    async healthCheck() {
        try {
            await this._fetch('/health');
            return true;
        } catch {
            return false;
        }
    }
}

export const motelandClient = new MotelandClient();
export default motelandClient;
