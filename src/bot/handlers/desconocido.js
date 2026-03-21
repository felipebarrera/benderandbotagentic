import { generateResponse } from '../intentDetector.js';
import { buildSystemPrompt } from '../promptManager.js';

export const handleDesconocido = async ({ tenant, conversacion, mensaje, entidades }) => {
    const systemPrompt = await buildSystemPrompt(tenant);
    const historial = [{ role: 'user', content: mensaje }];
    const contexto = 'El mensaje del cliente no fue clasificado dentro de las intenciones conocidas. Responde de forma amable y ofrece conectar con un humano si es necesario.';

    const respuesta = await generateResponse(systemPrompt, historial, contexto);

    return {
        respuesta: respuesta || 'No estoy seguro de cómo ayudarte con eso. Te conecto con un ejecutivo. 🙏',
        handover: true,
        cerrar: false
    };
};
