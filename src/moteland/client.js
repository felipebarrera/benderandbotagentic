// src/moteland/client.js
// PMS legacy de Moteland — desactivado para BenderAndos
// Los handlers que lo importan siguen funcionando — retornan vacío
import { logger } from '../config/logger.js';

class MotelandClient {
    constructor() {
        this.enabled = false;
        logger.info('MotelandClient disabled — BenderAndos does not use PMS legacy');
    }

    async getDisponibilidad(tenantId, fecha, personas) {
        return [];
    }

    async getPrecios(tenantId) {
        return [];
    }

    async crearReservaSimple(tenantId, datos) {
        logger.warn('crearReservaSimple called but MotelandClient is disabled');
        return null;
    }

    async healthCheck() {
        return false;
    }
}

export const motelandClient = new MotelandClient();
export default motelandClient;