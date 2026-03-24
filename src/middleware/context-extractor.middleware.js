/**
 * Extrae y normaliza contexto de mensaje WhatsApp/Telegram
 * VERSIÓN ROBUSTA: salta rutas que no son webhooks
 */

export const contextExtractorMiddleware = async (req, res, next) => {
    try {
        // === SKIP SI NO ES RUTA DE WEBHOOK ===
        // Solo procesar rutas que esperamos tengan from/to/body
        const isWebhookPath = req.path.startsWith('/webhook');

        if (!isWebhookPath) {
            // No es webhook → continuar sin modificar req.context
            return next();
        }

        const body = req.body || {};
        const { from, to, body: messageBody } = body;

        // Si es webhook pero faltan campos críticos, loggear y continuar
        if (!from || !to) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('[CONTEXT EXTRACTOR] Webhook sin from/to:', {
                    path: req.path,
                    method: req.method,
                    bodyKeys: Object.keys(body || {})
                });
            }
            req.context = {
                from: null,
                to: null,
                body: '',
                isCentralNumber: false,
                isTenantNumber: false,
                timestamp: new Date().toISOString(),
                incomplete: true,
                source: 'webhook'
            };
            return next();
        }

        // Normalizar números
        const normalizePhone = (phone) => {
            if (!phone) return phone;
            return phone.toString().replace(/[\s\-\(\)]/g, '');
        };

        const normalizedFrom = normalizePhone(from);
        const normalizedTo = normalizePhone(to);
        const centralNumber = normalizePhone(process.env.CENTRAL_PHONE_NUMBER);

        const isCentralNumber = normalizedTo === centralNumber;

        req.context = {
            from: normalizedFrom,
            to: normalizedTo,
            body: messageBody?.toString()?.trim() || '',
            isCentralNumber,
            isTenantNumber: !isCentralNumber,
            timestamp: new Date().toISOString(),
            incomplete: false,
            source: 'webhook'
        };

        // Modo test: sobrescribir contexto
        if (req.testMode?.active) {
            req.context.from = normalizePhone(req.testMode.phoneFrom);
            req.context.isCentralNumber = req.testMode.flowType === 'onboard';
            req.context.isTenantNumber = req.testMode.flowType !== 'onboard';
            console.log(`[CONTEXT] Modificado por test mode: ${JSON.stringify(req.context)}`);
        }

        next();
    } catch (error) {
        console.error('[CONTEXT EXTRACTOR] Error:', error);
        // No romper la request
        req.context = {
            from: null,
            to: null,
            body: '',
            isCentralNumber: false,
            isTenantNumber: false,
            timestamp: new Date().toISOString(),
            error: error.message,
            source: 'webhook'
        };
        next();
    }
};