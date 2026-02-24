import OpenAI from 'openai';
import config from '../config/index.js';
import { logger } from '../config/logger.js';
import { buildIntentPrompt } from './promptManager.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export const detectIntent = async (mensaje, fechaActual) => {
    const start = Date.now();
    const fallback = { intent: 'DESCONOCIDO', fecha: null, personas: null, tipo: null };

    try {
        const prompt = buildIntentPrompt(mensaje, fechaActual);

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 150,
            timeout: 3000
        });

        const raw = completion.choices[0]?.message?.content?.trim();
        const duration = Date.now() - start;
        logger.info('Intent detection completed', { duration, raw });

        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            logger.warn('Intent detection: no JSON found in response', { raw });
            return fallback;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return {
            intent: parsed.intent || 'DESCONOCIDO',
            fecha: parsed.fecha || null,
            personas: parsed.personas || null,
            tipo: parsed.tipo || null
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

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 200,
            timeout: 5000
        });

        const content = completion.choices[0]?.message?.content?.trim();
        const duration = Date.now() - start;
        logger.info('Response generation completed', { duration });

        return content || null;
    } catch (err) {
        const duration = Date.now() - start;
        logger.error('Response generation failed', { error: err.message, duration });
        return null;
    }
};
