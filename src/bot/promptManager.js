import { SYSTEM_PROMPT_BASE, INTENT_DETECTION_PROMPT } from './prompts.js';
import { redis } from '../db/redis.js';

export const buildSystemPrompt = async (tenant) => {
    const cacheKey = `prompt:system:${tenant.id}`;

    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    let prompt = SYSTEM_PROMPT_BASE.replace(/{nombre_negocio}/g, tenant.nombre);

    if (tenant.prompt_personalizado) {
        prompt += `\n\nInstrucciones adicionales del negocio:\n${tenant.prompt_personalizado}`;
    }

    await redis.setex(cacheKey, 1800, prompt);
    return prompt;
};

export const buildIntentPrompt = (mensaje, fechaActual) => {
    return INTENT_DETECTION_PROMPT.replace(/{fecha_actual}/g, fechaActual) + `\n\nMensaje del cliente: "${mensaje}"`;
};
