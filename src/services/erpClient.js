import axios from 'axios';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { logger } from '../config/logger.js';

const JWT_BRIDGE_SECRET = process.env.JWT_BRIDGE_SECRET || 'benderand_shared_secret_2026';
const ERP_BASE_URL = process.env.ERP_BASE_URL || 'http://host.docker.internal:8000';

class ErpClient {
    /**
     * Genera un token para identificarse ante el ERP como el bot de un tenant.
     */
    _generateToken(tenantId) {
        return jwt.sign({ tenant_id: tenantId }, JWT_BRIDGE_SECRET, { expiresIn: '1h' });
    }

    /**
     * Realiza una petición al ERP inyectando el host del tenant y el token JWT.
     */
    async _request(tenant, method, endpoint, data = null) {
        const token = this._generateToken(tenant.id);
        const domain = tenant.domain || `${tenant.id}.localhost`; // fallback
        
        try {
            const response = await axios({
                method,
                url: `${ERP_BASE_URL}${endpoint}`,
                data,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Host': `${domain}:8000`, // Crucial para Tenancy en puerto 8000
                    'Accept': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            logger.error(`ERP Request failed: ${method} ${endpoint}`, {
                tenant: tenant.id,
                error: error.response?.data || error.message
            });
            throw error;
        }
    }

    /**
     * Obtiene los datos del portal público para el context del bot.
     */
    async getPortalData(tenant) {
        try {
            return await this._request(tenant, 'GET', '/api/bot/portal-data');
        } catch (error) {
            return null; // Fallback silencioso
        }
    }
}

export const erpClient = new ErpClient();
export default erpClient;
