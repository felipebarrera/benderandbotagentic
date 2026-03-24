// src/captacion/flujos/negocio.js
import { CAPTACION_PROMPT_BASE } from '../prompts.js';
import { prisma } from '../../db/prisma.js';
import OpenAI from 'openai';
import config from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { crearTenant } from '../onboarding.js';

const llm = new OpenAI({
  baseURL: config.llm.baseURL,
  apiKey: config.llm.apiKey,
});

/**
 * Maneja el flujo para dueños de negocios pequeños.
 * 4 Fases: Identificación -> Hook Económico -> Demo Rubro -> Conversión
 */
export async function manejarFlujoNegocio(prospecto, texto, historial) {
  // FASE 4: CONVERSIÓN
  if (prospecto.estado === 'conversion') {
     const extractionPrompt = `Extrae (si existen) Nombre, RUT e Industria/Nombre del Negocio de este mensaje o del historial.
     Mensaje: "${texto}"
     Historial: "${historial}"
     Responde SOLO JSON: {"nombre": null, "rut": null, "industria": null}`;
     
     try {
       const extraction = await llm.chat.completions.create({
         model: config.llm.model,
         messages: [{ role: 'system', content: extractionPrompt }],
         response_format: { type: 'json_object' }
       });
       const data = JSON.parse(extraction.choices[0].message.content);
       
       const currentData = { ...prospecto.datosJson, ...data };
       await prisma.prospecto.update({ where: { id: prospecto.id }, data: { datosJson: currentData } });

       if (currentData.nombre && currentData.rut) {
          const result = await crearTenant({
            nombre: currentData.nombre,
            rut: currentData.rut,
            industria: prospecto.rubroDetectado || currentData.industria || 'general',
            whatsapp: prospecto.canalId,
            canal: prospecto.canal
          });

          await prisma.prospecto.update({ 
            where: { id: prospecto.id }, 
            data: { estado: 'convertido', tenantSlug: result.tenant_slug, convertidoAt: new Date() } 
          });

          return `¡Felicidades ${currentData.nombre}! Tu negocio "${result.tenant_slug}" ya está en BenderAnd 🚀\n\n` +
                 `Panel: ${result.url}\n` +
                 `Usuario: ${result.email}\n` +
                 `Clave: ${result.clave_temporal}\n\n` +
                 `¿Conoces a otro dueño de negocio? Por cada registro con tu link, ¡te damos un mes de suscripción!`;
       }
     } catch (e) {
       logger.error('Error en onboarding negocio', { error: e.message });
     }
  }

  const systemPrompt = CAPTACION_PROMPT_BASE

    .replace('{perfil}', 'Dueño de Negocio')
    .replace('{rubro}', prospecto.rubroDetectado || 'Pendiente')
    .replace('{fase}', prospecto.estado)
    .replace('{mrrCalculado}', 'N/A (Cálculo por pérdida de ventas)')
    .replace('{referidorNombre}', 'Ninguno')
    .replace('{historial}', historial);

  try {
    const aiResponse = await llm.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: texto }
      ]
    });
    return aiResponse.choices[0].message.content;
  } catch (error) {
    logger.error('Error en LLM flujo negocio', { error: error.message });
    return "¿Cómo llevas hoy el control de tus ventas y stock?";
  }
}
