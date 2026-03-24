/**
 * Clasificador de intenciones usando Ollama + llama3.1:8b
 * Retorna JSON estructurado con perfil, intención y datos extraídos
 */

export class IntentClassifierService {
    constructor() {
        this.ollamaHost = process.env.OLLAMA_HOST || 'http://host.docker.internal:11434';
        this.model = process.env.LLM_MODEL || 'llama3.1:8b';
    }

    /**
     * Clasifica la intención del mensaje con contexto de enrutamiento
     * @param {object} params 
     * @param {string} params.message - Mensaje del usuario
     * @param {object} params.context - Contexto: { isCentralNumber, isTenantNumber, from, to }
     * @param {string} params.testFlowType - Flujo forzado en modo test (opcional)
     * @returns {Promise<object>} Clasificación en JSON
     */
    async classify({ message, context, testFlowType = null }) {
        // Si hay flujo forzado, retornar clasificación predefinida
        if (testFlowType) {
            return this._getTestClassification(testFlowType, message);
        }

        const prompt = this._buildPrompt(message, context);

        try {
            const response = await fetch(`${this.ollamaHost}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    format: 'json',
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 500
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.message?.content;

            if (!content) {
                return this._getDefaultClassification(context);
            }

            // Parsear JSON de respuesta (puede venir con markdown code blocks)
            const jsonContent = content.replace(/```json\s*|\s*```/g, '').trim();
            const classification = JSON.parse(jsonContent);

            // Validar estructura mínima
            if (!classification.perfil || !classification.intencion) {
                return this._getDefaultClassification(context);
            }

            return {
                ...classification,
                confidence: classification.confianza || 0.5,
                raw_message: message,
                classified_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('[INTENT CLASSIFIER] Error:', error);
            // Fallback a clasificación por reglas
            return this._classifyByRules(message, context);
        }
    }

    /**
     * Construye el prompt para Ollama con contexto y reglas
     */
    _buildPrompt(message, context) {
        return `
Eres un clasificador de intenciones para un bot de WhatsApp de BenderAnd ERP.

CONTEXTO DEL MENSAJE:
- Número destino: ${context.to}
- Número origen: ${context.from}
- ¿Es número central (superadmin)?: ${context.isCentralNumber}
- ¿Es número de tenant (negocio)?: ${context.isTenantNumber}

MENSAJE DEL USUARIO: "${message}"

CLASIFICA ESTRICTAMENTE en formato JSON:
{
  "perfil": "tenant" | "cliente" | "onboard" | "desconocido",
  "intencion": "info" | "ventas" | "reclamo" | "soporte" | "onboarding" | "demo" | "credenciales",
  "confianza": 0.0-1.0,
  "datos_extraer": {
    "rut": string|null,
    "nombre": string|null,
    "industria": string|null,
    "producto": string|null,
    "cantidad": number|null
  }
}

REGLAS DE CLASIFICACIÓN:
1. Si contexto.isTenantNumber = true → perfil probables: "cliente" o "tenant"
2. Si contexto.isCentralNumber = true → perfil probables: "onboard" o "cliente"
3. Palabras clave para "info": precio, cuánto, costo, valor, horario, ubicación, dirección
4. Palabras clave para "ventas": comprar, pedir, reservar, quiero, llevar, carrito
5. Palabras clave para "reclamo": problema, error, no funciona, reclamo, queja, mal
6. Palabras clave para "onboarding": quiero probar, demo, registrarme, nuevo, empezar
7. Palabras clave para "credenciales": contraseña, clave, acceder, login, entrar
8. Si menciona RUT (formato XX.XXX.XXX-X o XXXXXXXX-X) → extraer en datos_extraer.rut
9. Si menciona industria (ferretería, clínica, restaurante, etc.) → extraer en datos_extraer.industria

EJEMPLOS:
Input: "¿cuánto cuesta la leche?" + isTenantNumber=true
Output: {"perfil":"cliente","intencion":"info","confianza":0.95,"datos_extraer":{"producto":"leche"}}

Input: "quiero probar para mi ferretería" + isCentralNumber=true  
Output: {"perfil":"onboard","intencion":"demo","confianza":0.98,"datos_extraer":{"industria":"ferretería"}}

Input: "olvidé mi contraseña" + isCentralNumber=true
Output: {"perfil":"cliente","intencion":"credenciales","confianza":0.92,"datos_extraer":{}}

Ahora clasifica el mensaje real. Responde SOLO con JSON válido, sin texto adicional.
`.trim();
    }

    /**
     * Clasificación predefinida para modo test
     */
    _getTestClassification(flowType, message) {
        const base = {
            confianza: 1.0,
            test_mode: true,
            raw_message: message,
            classified_at: new Date().toISOString()
        };

        switch (flowType) {
            case 'cliente':
                return {
                    ...base,
                    perfil: 'cliente',
                    intencion: this._detectIntentFromMessage(message),
                    datos_extraer: this._extractData(message)
                };
            case 'tenant':
                return {
                    ...base,
                    perfil: 'tenant',
                    intencion: 'info', // tenant suele consultar info operativa
                    datos_extraer: {}
                };
            case 'onboard':
                return {
                    ...base,
                    perfil: 'onboard',
                    intencion: message.toLowerCase().includes('demo') ? 'demo' : 'onboarding',
                    datos_extraer: this._extractData(message)
                };
            default:
                return this._getDefaultClassification({ isCentralNumber: true });
        }
    }

    /**
     * Fallback: clasificación por reglas simples si Ollama falla
     */
    _classifyByRules(message, context) {
        const lower = message.toLowerCase();
        const datos = this._extractData(message);

        // Detección de intención por palabras clave
        let intencion = 'info';
        if (/(comprar|pedir|reservar|quiero.*\d|carrito)/.test(lower)) intencion = 'ventas';
        else if (/(problema|error|no funciona|reclamo|queja|mal)/.test(lower)) intencion = 'reclamo';
        else if (/(probar|demo|registrarme|nuevo|empezar|activar)/.test(lower)) intencion = 'onboarding';
        else if (/(contraseña|clave|acceder|login|entrar|recuperar)/.test(lower)) intencion = 'credenciales';

        // Determinar perfil por contexto
        let perfil = 'desconocido';
        if (context.isTenantNumber) perfil = 'cliente';
        else if (context.isCentralNumber) {
            perfil = intencion === 'onboarding' || intencion === 'demo' ? 'onboard' : 'cliente';
        }

        return {
            perfil,
            intencion,
            confianza: 0.6, // Menor confianza que Ollama
            datos_extraer: datos,
            fallback: true,
            raw_message: message,
            classified_at: new Date().toISOString()
        };
    }

    /**
     * Extrae datos estructurados del mensaje (RUT, nombres, industria)
     */
    _extractData(message) {
        const datos = { rut: null, nombre: null, industria: null, producto: null, cantidad: null };

        // Extraer RUT chileno (formato XX.XXX.XXX-X o XXXXXXXX-X)
        const rutMatch = message.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b|\b\d{7,8}-[\dkK]\b/);
        if (rutMatch) datos.rut = rutMatch[0];

        // Extraer industria (lista simplificada)
        const industrias = ['ferretería', 'ferreteria', 'clínica', 'clinica', 'restaurante', 'abarrotes', 'motel', 'legal', 'abogado', 'dentista', 'médico', 'medico', 'gimnasio', 'taller', 'gasfíter'];
        for (const ind of industrias) {
            if (message.toLowerCase().includes(ind)) {
                datos.industria = ind;
                break;
            }
        }

        // Extraer cantidad numérica simple
        const qtyMatch = message.match(/(\d+)\s*(?:unidades|bolsas|cajas|litros|kg)?/i);
        if (qtyMatch) datos.cantidad = parseInt(qtyMatch[1]);

        return datos;
    }

    /**
     * Detección simple de intención para modo test
     */
    _detectIntentFromMessage(message) {
        const lower = message.toLowerCase();
        if (/(comprar|pedir|reservar|quiero.*\d)/.test(lower)) return 'ventas';
        if (/(problema|error|reclamo)/.test(lower)) return 'reclamo';
        if (/(precio|cuánto|costo|horario)/.test(lower)) return 'info';
        return 'info';
    }

    /**
     * Clasificación por defecto cuando no se puede determinar
     */
    _getDefaultClassification(context) {
        return {
            perfil: context.isCentralNumber ? 'onboard' : 'cliente',
            intencion: 'info',
            confianza: 0.3,
            datos_extraer: {},
            fallback: true,
            raw_message: '',
            classified_at: new Date().toISOString()
        };
    }
    /**
 * Método para clasificación con contexto de enrutamiento y modo test
 * Integrar en la clase existente
 */
    async classifyWithContext({ message, context, testFlowType = null }) {
        // Si hay flujo forzado, retornar clasificación predefinida
        if (testFlowType) {
            return this._getTestClassification(testFlowType, message);
        }

        // Construir prompt con contexto de enrutamiento
        const prompt = `
Eres un clasificador de intenciones para un bot de WhatsApp de BenderAnd ERP.

CONTEXTO DEL MENSAJE:
- Número destino: ${context.to}
- Número origen: ${context.from}
- ¿Es número central (superadmin)?: ${context.isCentralNumber}
- ¿Es número de tenant (negocio)?: ${context.isTenantNumber}

MENSAJE DEL USUARIO: "${message}"

CLASIFICA ESTRICTAMENTE en formato JSON:
{
  "perfil": "tenant" | "cliente" | "onboard" | "desconocido",
  "intencion": "info" | "ventas" | "reclamo" | "soporte" | "onboarding" | "demo" | "credenciales",
  "confianza": 0.0-1.0,
  "datos_extraer": {
    "rut": string|null,
    "nombre": string|null,
    "industria": string|null,
    "producto": string|null,
    "cantidad": number|null
  }
}

REGLAS:
1. Si contexto.isTenantNumber = true → perfil probables: "cliente" o "tenant"
2. Si contexto.isCentralNumber = true → perfil probables: "onboard" o "cliente"
3. Palabras clave para "info": precio, cuánto, costo, valor, horario, ubicación
4. Palabras clave para "ventas": comprar, pedir, reservar, quiero, llevar
5. Palabras clave para "reclamo": problema, error, no funciona, reclamo, queja
6. Palabras clave para "onboarding": quiero probar, demo, registrarme, nuevo
7. Palabras clave para "credenciales": contraseña, clave, acceder, login
8. Si menciona RUT → extraer en datos_extraer.rut
9. Si menciona industria → extraer en datos_extraer.industria

Responde SOLO con JSON válido.
`.trim();

        // Usar la configuración existente de LLM (provider, model, temperature, etc.)
        // Esto ya está implementado en tu servicio, solo adaptar el prompt
        return await this._callLLM(prompt, { format: 'json' });
    }

    /**
     * Clasificación predefinida para modo test (helper interno)
     */
    _getTestClassification(flowType, message) {
        const base = {
            confianza: 1.0,
            test_mode: true,
            raw_message: message,
            classified_at: new Date().toISOString()
        };

        switch (flowType) {
            case 'cliente':
                return {
                    ...base,
                    perfil: 'cliente',
                    intencion: this._detectIntentFromMessage(message),
                    datos_extraer: this._extractData(message)
                };
            case 'tenant':
                return {
                    ...base,
                    perfil: 'tenant',
                    intencion: 'info',
                    datos_extraer: {}
                };
            case 'onboard':
                return {
                    ...base,
                    perfil: 'onboard',
                    intencion: message.toLowerCase().includes('demo') ? 'demo' : 'onboarding',
                    datos_extraer: this._extractData(message)
                };
            default:
                return { ...base, perfil: 'desconocido', intencion: 'info', datos_extraer: {} };
        }
    }

    /**
     * Detección simple de intención para modo test
     */
    _detectIntentFromMessage(message) {
        const lower = message.toLowerCase();
        if (/(comprar|pedir|reservar|quiero.*\d)/.test(lower)) return 'ventas';
        if (/(problema|error|reclamo)/.test(lower)) return 'reclamo';
        if (/(precio|cuánto|costo|horario)/.test(lower)) return 'info';
        return 'info';
    }

    /**
     * Extrae datos estructurados del mensaje
     */
    _extractData(message) {
        const datos = { rut: null, nombre: null, industria: null, producto: null, cantidad: null };

        // Extraer RUT chileno
        const rutMatch = message.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b|\b\d{7,8}-[\dkK]\b/);
        if (rutMatch) datos.rut = rutMatch[0];

        // Extraer industria (lista simplificada - ver BENDERAND_CONFIG_INDUSTRIAS.md)
        const industrias = ['ferretería', 'ferreteria', 'clínica', 'clinica', 'restaurante', 'abarrotes', 'motel', 'legal', 'abogado', 'dentista', 'médico', 'medico', 'gimnasio', 'taller', 'gasfíter'];
        for (const ind of industrias) {
            if (message.toLowerCase().includes(ind)) {
                datos.industria = ind;
                break;
            }
        }

        // Extraer cantidad numérica simple
        const qtyMatch = message.match(/(\d+)\s*(?:unidades|bolsas|cajas|litros|kg)?/i);
        if (qtyMatch) datos.cantidad = parseInt(qtyMatch[1]);

        return datos;
    }
}

// Exportar instancia singleton
export const intentClassifier = new IntentClassifierService();