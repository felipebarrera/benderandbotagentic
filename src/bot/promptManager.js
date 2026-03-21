import { SYSTEM_PROMPT_BASE, INTENT_DETECTION_PROMPT } from './prompts.js';
import { redis } from '../db/redis.js';
import { erpClient } from '../services/erpClient.js';

export const buildSystemPrompt = async (tenant) => {
    const cacheKey = `prompt:system:${tenant.id}`;

    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    let prompt = SYSTEM_PROMPT_BASE.replace(/{nombre_negocio}/g, tenant.nombre);

    // Contexto del Portal Público (Hito 3)
    try {
        const portal = await erpClient.getPortalData(tenant);
        if (portal) {
            let portalCtx = `\n\nInformación del Portal Público:\n`;
            if (portal.descripcion) portalCtx += `- Descripción: ${portal.descripcion}\n`;
            if (portal.horario)     portalCtx += `- Horario: ${portal.horario}\n`;
            if (portal.telefono)    portalCtx += `- Teléfono: ${portal.telefono}\n`;
            if (portal.direccion)   portalCtx += `- Dirección: ${portal.direccion}\n`;
            if (portal.whatsapp)    portalCtx += `- WhatsApp: ${portal.whatsapp}\n`;
            
            prompt = prompt.replace(/{portal_context}/g, portalCtx);
        } else {
            prompt = prompt.replace(/{portal_context}/g, '');
        }
    } catch (e) {
        prompt = prompt.replace(/{portal_context}/g, '');
    }

    if (tenant.prompt_personalizado) {
        prompt += `\n\nInstrucciones adicionales del negocio:\n${tenant.prompt_personalizado}`;
    }

    await redis.setex(cacheKey, 1800, prompt);
    return prompt;
};


export const buildIntentPrompt = (mensaje, fechaActual) => {
    return INTENT_DETECTION_PROMPT.replace(/{fecha_actual}/g, fechaActual) + `\n\nMensaje del cliente: "${mensaje}"`;
};
