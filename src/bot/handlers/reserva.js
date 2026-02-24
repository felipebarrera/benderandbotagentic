import { motelandClient } from '../../moteland/client.js';
import { formatReservaConfirmada } from '../../moteland/formatters.js';
import { logger } from '../../config/logger.js';

export const handleReserva = async ({ tenant, conversacion, mensaje, entidades }) => {
    if (!entidades.fecha) {
        return {
            respuesta: '¿Para qué fecha necesitas la reserva?',
            handover: false,
            cerrar: false
        };
    }

    if (!entidades.personas) {
        return {
            respuesta: '¿Para cuántas personas sería la reserva?',
            handover: false,
            cerrar: false
        };
    }

    try {
        const resultado = await motelandClient.crearReservaSimple(tenant.id, {
            fecha: entidades.fecha,
            personas: entidades.personas,
            contacto: {
                nombre: conversacion.contact_name || 'Cliente',
                whatsapp: conversacion.whatsapp_contact
            }
        });

        return {
            respuesta: formatReservaConfirmada(resultado),
            handover: false,
            cerrar: false
        };
    } catch (err) {
        logger.error('handleReserva error', { tenantId: tenant.id, error: err.message });
        return {
            respuesta: 'No pudimos completar la reserva automáticamente. Te conecto con un ejecutivo para ayudarte.',
            handover: true,
            cerrar: false
        };
    }
};
