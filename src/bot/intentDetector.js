import OpenAI from 'openai';
import config from '../config/index.js';
import { logger } from '../config/logger.js';
import { buildIntentPrompt } from './promptManager.js';

// Cliente LLM desde config — Ollama ahora, OpenRouter/OpenAI después
// Solo cambia .env para migrar, nada de código
const llm = new OpenAI({
    baseURL: config.llm.baseURL,
    apiKey:  config.llm.apiKey,
});

export const detectIntent = async (mensaje, fechaActual) => {
    const start = Date.now();
    const fallback = { intent: 'DESCONOCIDO', fecha: null, personas: null, tipo: null };
    try {
        const prompt = buildIntentPrompt(mensaje, fechaActual);
        const completion = await llm.chat.completions.create({
            model:       config.llm.model,
            messages:    [{ role: 'user', content: prompt }],
            temperature: 0,           // detección de intención — siempre determinista
            max_tokens:  150,
        });
        const raw = completion.choices[0]?.message?.content?.trim();
        const duration = Date.now() - start;
        logger.info('Intent detection completed', { duration, raw, model: config.llm.model });

        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            logger.warn('Intent detection: no JSON found in response', { raw });
            return fallback;
        }
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            intent:   parsed.intent   || 'DESCONOCIDO',
            fecha:    parsed.fecha    || null,
            personas: parsed.personas || null,
            tipo:     parsed.tipo     || null
        };
    } catch (err) {
        const duration = Date.now() - start;
        logger.error('Intent detection failed', { error: err.message, duration });
        return fallback;
    }
};

export const generateResponse = async (systemPrompt, historial, contexto) => {
    const start = Date.now();
    try {
        let systemContent = systemPrompt;
        if (contexto) {
            systemContent += `\n\nInformación del sistema:\n${contexto}`;
        }
        const messages = [
            { role: 'system', content: systemContent },
            ...historial
        ];
        const completion = await llm.chat.completions.create({
            model:       config.llm.model,
            messages,
            temperature: config.llm.temperature,
            max_tokens:  config.llm.maxTokens,
        });
        const content = completion.choices[0]?.message?.content?.trim();
        const duration = Date.now() - start;
        logger.info('Response generation completed', { duration, model: config.llm.model });
        return content || null;
    } catch (err) {
        const duration = Date.now() - start;
        logger.error('Response generation failed', { error: err.message, duration });
        return null;
    }
};