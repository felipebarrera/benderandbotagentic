import { generateResponse } from '../intentDetector.js';
import { buildSystemPrompt } from '../promptManager.js';

export const handleSaludo = async ({ tenant, conversacion, mensaje, entidades }) => {
    const systemPrompt = await buildSystemPrompt(tenant);

    const hora = new Date().getHours();
    let periodo;
    if (hora < 12) periodo = 'mañana';
    else if (hora < 19) periodo = 'tarde';
    else periodo = 'noche';

    const contexto = `Tipo de interacción: saludo. Hora del día: ${periodo}. Es un saludo inicial del cliente.`;
    const historial = [{ role: 'user', content: mensaje }];

    const respuesta = await generateResponse(systemPrompt, historial, contexto);

    return {
        respuesta: respuesta || `¡Hola! 👋 Bienvenido/a a ${tenant.nombre}. ¿En qué te puedo ayudar?`,
        handover: false,
        cerrar: false
    };
};
