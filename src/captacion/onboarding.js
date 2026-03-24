// src/captacion/onboarding.js
import config from '../config/index.js';
import fetch from 'node-fetch';
import { logger } from '../config/logger.js';

/**
 * Llama al webhook del ERP para crear un nuevo tenant.
 * @param {object} datos { nombre, rut, industria, whatsapp, canal }
 * @returns {Promise<object>}
 */
export async function crearTenant({ nombre, rut, industria, whatsapp, canal }) {
  try {
    const url = `${config.erpBaseUrl}/webhook/whatsapp/onboarding`;
    logger.info('Iniciando onboarding en ERP', { url, whatsapp });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Token': config.internalSecret || 'benderandos_internal_2026',
      },
      body: JSON.stringify({ 
        nombre, 
        rut, 
        industria, 
        whatsapp, 
        canal: canal || 'whatsapp' 
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('ERP onboarding falló', { status: res.status, error: errorText });
      throw new Error(`ERP onboarding falló: ${res.status}`);
    }

    const data = await res.json();
    // ERP debería devolver: { tenant_slug, url, email, clave_temporal, modulos_activos }
    logger.info('Onboarding completado exitosamente', { tenant: data.tenant_slug });
    return data;
  } catch (error) {
    logger.error('Error en proceso de onboarding', { error: error.message });
    throw error;
  }
}
