/**
 * Servicio para resolver si un número pertenece a un tenant registrado
 * Consulta al ERP Laravel vía JWT Bridge
 */

import jwt from 'jsonwebtoken';

export class TenantResolverService {
    constructor() {
        this.erpBaseUrl = process.env.ERP_BASE_URL;
        this.jwtSecret = process.env.JWT_SHARED_SECRET;
    }

    /**
     * Genera token JWT compartido para autenticar con el ERP
     */
    _generateBridgeToken() {
        return jwt.sign(
            {
                source: 'whatsapp_bot',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600 // 1 hora
            },
            this.jwtSecret,
            { algorithm: 'HS256' }
        );
    }

    /**
     * Busca tenant por número de WhatsApp administrativo
     * @param {string} phone - Número a buscar
     * @returns {Promise<object|null>} Datos del tenant o null
     */
    async findByPhone(phone) {
        try {
            const token = this._generateBridgeToken();

            const response = await fetch(
                `${this.erpBaseUrl}/api/internal/bot/tenant-by-phone/${phone}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'X-Bot-Token': this.jwtSecret // Header adicional de seguridad
                    }
                }
            );

            if (response.status === 404) {
                return null;
            }

            if (!response.ok) {
                console.error(`[TENANT RESOLVER] Error ${response.status}:`, await response.text());
                return null;
            }

            const data = await response.json();
            return data.tenant || null;

        } catch (error) {
            console.error('[TENANT RESOLVER] Exception:', error);
            return null;
        }
    }

    /**
     * Busca cliente por teléfono en un tenant específico
     * @param {string} tenantUuid - UUID del tenant
     * @param {string} phone - Teléfono del cliente
     * @returns {Promise<object|null>} Datos del cliente o null
     */
    async findCustomerByPhone(tenantUuid, phone) {
        try {
            const token = this._generateBridgeToken();

            const response = await fetch(
                `${this.erpBaseUrl}/api/internal/bot/cliente/${phone}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'X-Tenant-Uuid': tenantUuid, // Identifica el schema del tenant
                        'X-Bot-Token': this.jwtSecret
                    }
                }
            );

            if (response.status === 404) {
                return null;
            }

            if (!response.ok) {
                console.error(`[CUSTOMER RESOLVER] Error ${response.status}:`, await response.text());
                return null;
            }

            const data = await response.json();
            return data.cliente || null;

        } catch (error) {
            console.error('[CUSTOMER RESOLVER] Exception:', error);
            return null;
        }
    }
}

// Exportar instancia singleton
export const tenantResolver = new TenantResolverService();