import { motelandClient } from '../../moteland/client.js';
import { formatPrecios } from '../../moteland/formatters.js';
import { logger } from '../../config/logger.js';

export const handlePrecios = async ({ tenant, conversacion, mensaje, entidades }) => {
    try {
        const precios = await motelandClient.getPrecios(tenant.id);

        if (precios && precios.length > 0) {
            return { respuesta: formatPrecios(precios), handover: false, cerrar: false };
        }
    } catch (err) {
        logger.error('handlePrecios error', { tenantId: tenant.id, error: err.message });
    }

    return {
        respuesta: 'En este momento no podemos mostrar precios. ¿Quieres hablar con un ejecutivo?',
        handover: false,
        cerrar: false
    };
};
