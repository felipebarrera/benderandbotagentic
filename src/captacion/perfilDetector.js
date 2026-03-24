// src/captacion/perfilDetector.js
import OpenAI from 'openai';
import config from '../config/index.js';
import { PERFIL_DETECTOR_PROMPT } from './prompts.js';
import { logger } from '../config/logger.js';

const llm = new OpenAI({
  baseURL: config.llm.baseURL,
  apiKey: config.llm.apiKey,
});

/**
 * Usa el LLM para clasificar el primer mensaje de un prospecto.
 * @param {string} texto 
 * @returns {Promise<object>} { perfil, rubro, confianza }
 */
export async function detectarPerfil(texto) {
  try {
    const response = await llm.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: PERFIL_DETECTOR_PROMPT },
        { role: 'user', content: texto }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    const data = JSON.parse(content);
    
    logger.info('Perfil detectado para prospecto', { 
      perfil: data.perfil, 
      rubro: data.rubro, 
      confianza: data.confianza 
    });

    return {
      perfil: data.perfil || 'EMPRENDEDOR',
      rubro: data.rubro || null,
      confianza: data.confianza || 0
    };
  } catch (error) {
    logger.error('Error detectando perfil de prospecto', { error: error.message });
    return { perfil: 'EMPRENDEDOR', rubro: null, confianza: 0 };
  }
}
