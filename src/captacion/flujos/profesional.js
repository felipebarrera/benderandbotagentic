import { calcular } from '../calculadora.js';
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
 * Maneja el flujo para profesionales independientes.
 * 4 Fases: Enganche -> Calculadora -> Demo/Dolor -> Conversión
 */
export async function manejarFlujoProfesional(prospecto, texto, historial) {
  let respuesta = "";

  // FASE 2: CALCULADORA (Si estamos esperando horas)
  if (prospecto.estado === 'calculadora') {
    // Intentar extraer número de horas con LLM o regex simple
    const horasMatch = texto.match(/\d+/);
    if (horasMatch) {
      const horas = parseInt(horasMatch[0]);
      const calculo = calcular(prospecto.rubroDetectado || 'profesor', horas);
      
      if (calculo) {
        respuesta = `¡Entendido! Con ${horas} horas libres, cobrando $${calculo.tarifaReferencia.toLocaleString('es-CL')} por ${calculo.label}, podrías estar generando:\n` +
                    `- $${calculo.semana.toLocaleString('es-CL')} esta semana\n` +
                    `- $${calculo.mes.toLocaleString('es-CL')} este mes\n\n` +
                    `¿Eso cambiaría algo en tu situación hoy?`;
        
        await prisma.prospecto.update({
          where: { id: prospecto.id },
          data: { 
            estado: 'demo', 
            mrrCalculado: calculo.mes,
            datosJson: { ...prospecto.datosJson, horasLibres: horas }
          }
        });
        return respuesta;
      }
    }
  }

  // FASE 4: CONVERSIÓN (Si estamos pidiendo datos)
  if (prospecto.estado === 'conversion') {
     // Usamos el LLM para extraer Nombre, RUT e Industria de la respuesta o historial
     const extractionPrompt = `Extrae (si existen) Nombre, RUT e Industria de este mensaje o del historial reciente.
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
          // Tenemos lo mínimo para onboardear
          const result = await crearTenant({
            nombre: currentData.nombre,
            rut: currentData.rut,
            industria: prospecto.rubroDetectado || currentData.industria || 'independiente',
            whatsapp: prospecto.canalId,
            canal: prospecto.canal
          });

          await prisma.prospecto.update({ 
            where: { id: prospecto.id }, 
            data: { estado: 'convertido', tenantSlug: result.tenant_slug, convertidoAt: new Date() } 
          });

          return `¡Listo ${currentData.nombre}! Tu cuenta está lista 🎉\n\n` +
                 `Acceso: ${result.url}\n` +
                 `Usuario: ${result.email}\n` +
                 `Clave temporal: ${result.clave_temporal}\n\n` +
                 `¿Conoces a alguien más que necesite digitalizar su trabajo? Por cada referido que se una, ¡ganas 1 mes gratis! 🎁`;
       }
     } catch (e) {
       logger.error('Error en extracción/onboarding profesional', { error: e.message });
     }
  }

  // Comportamiento por defecto: dejar que el LLM genere la respuesta según la fase
  const systemPrompt = CAPTACION_PROMPT_BASE
    .replace('{perfil}', 'Profesional Independiente')
    .replace('{rubro}', prospecto.rubroDetectado || 'Pendiente')
    .replace('{fase}', prospecto.estado)
    .replace('{mrrCalculado}', prospecto.mrrCalculado ? `${prospecto.mrrCalculado.toLocaleString('es-CL')} CLP` : 'Pendiente')
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
    logger.error('Error en LLM flujo profesional', { error: error.message });
    return "Cuéntame un poco más, ¿qué es lo que más te quita tiempo hoy?";
  }
}
