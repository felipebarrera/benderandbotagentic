export const TEMPLATES = {
    BIENVENIDA: '¡Hola! 👋 Bienvenido/a a {nombre_negocio}. ¿En qué te puedo ayudar?',
    FUERA_HORARIO: 'Hola! En este momento estamos fuera de horario de atención. Te responderemos a partir de las {hora_inicio} 🕐',
    HANDOVER_AVISO: 'Un ejecutivo te atenderá en breve. ¡Gracias por tu paciencia! 🙏',
    ERROR_GENERAL: 'Disculpa, tuve un problema procesando tu mensaje. Te conecto con un ejecutivo.',
    DESPEDIDA: '¡Gracias por contactarnos! Si necesitas algo más, escríbenos. ¡Que te vaya bien! 😊'
};

export const fillTemplate = (templateKey, data = {}) => {
    let text = TEMPLATES[templateKey] || templateKey;
    for (const [key, value] of Object.entries(data)) {
        text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return text;
};

export default TEMPLATES;
