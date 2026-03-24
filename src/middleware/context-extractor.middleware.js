/**
 * Extrae y normaliza contexto de mensaje WhatsApp:
 * - Número origen (from)
 * - Número destino (to) 
 * - Identifica si es número central o de tenant
 */

export const contextExtractorMiddleware = async (req, res, next) => {
    try {
        const { from, to, body } = req.body;

        if (!from || !to) {
            return res.status(400).json({ error: 'Faltan campos from/to' });
        }

        // Normalizar números (quitar espacios, guiones, asegurar formato E.164)
        const normalizePhone = (phone) => {
            return phone.replace(/[\s\-\(\)]/g, '');
        };

        const normalizedFrom = normalizePhone(from);
        const normalizedTo = normalizePhone(to);
        const centralNumber = normalizePhone(process.env.CENTRAL_PHONE_NUMBER);

        // Determinar tipo de número destino
        const isCentralNumber = normalizedTo === centralNumber;

        // Contexto base
        req.context = {
            from: normalizedFrom,
            to: normalizedTo,
            body: body?.trim() || '',
            isCentralNumber,
            isTenantNumber: !isCentralNumber, // Si no es central, asumimos tenant (se valida después)
            timestamp: new Date().toISOString()
        };

        // Si es modo test, sobrescribir con valores forzados
        if (req.testMode?.active) {
            req.context.from = normalizePhone(req.testMode.phoneFrom);
            req.context.isCentralNumber = req.testMode.flowType === 'onboard';
            req.context.isTenantNumber = req.testMode.flowType !== 'onboard';
            console.log(`[CONTEXT] Modificado por test mode: ${JSON.stringify(req.context)}`);
        }

        next();
    } catch (error) {
        console.error('[CONTEXT EXTRACTOR] Error:', error);
        res.status(500).json({ error: 'Error extrayendo contexto' });
    }
};