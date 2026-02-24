import { generateResponse } from '../intentDetector.js';
import { buildSystemPrompt } from '../promptManager.js';

export const handleDesconocido = async ({ tenant, conversacion, mensaje, entidades }) => {
    const systemPrompt = await buildSystemPrompt(tenant);
    const historial = [{ role: 'user', content: mensaje }];
    const contexto = 'El mensaje del cliente no fue clasificado claramente. Intenta dar una respuesta útil o sugiere hablar con un ejecutivo.';

    const respuesta = await generateResponse(systemPrompt, historial, contexto);

    if (respuesta) {
        return { respuesta, handover: true, cerrar: false };
    }

    return {
        respuesta: 'No entendí bien tu consulta. Te conecto con un ejecutivo para ayudarte. 🙏',
        handover: true,
        cerrar: false
    };
};
