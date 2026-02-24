import { motelandClient } from '../../moteland/client.js';
import { formatDisponibilidad, formatErrorPMS } from '../../moteland/formatters.js';
import { logger } from '../../config/logger.js';

export const handleDisponibilidad = async ({ tenant, conversacion, mensaje, entidades }) => {
    try {
        const fecha = entidades.fecha || new Date().toISOString().split('T')[0];
        const personas = entidades.personas || null;

        const habitaciones = await motelandClient.getDisponibilidad(tenant.id, fecha, personas);

        if (habitaciones && habitaciones.length > 0) {
            return { respuesta: formatDisponibilidad(habitaciones), handover: false, cerrar: false };
        } else if (habitaciones && habitaciones.length === 0) {
            return {
                respuesta: 'Lo sentimos, no tenemos disponibilidad para esa fecha. ¿Te gustaría consultar otra fecha?',
                handover: false,
                cerrar: false
            };
        }
    } catch (err) {
        logger.error('handleDisponibilidad error', { tenantId: tenant.id, error: err.message });
    }

    return { respuesta: formatErrorPMS(), handover: true, cerrar: false };
};
