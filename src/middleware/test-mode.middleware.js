/**
 * Middleware para modo de prueba con TEST_FLOW_TYPE
 * Inyecta contexto forzado para desarrollo sin detección automática
 */

export const testModeMiddleware = (req, res, next) => {
    const { TEST_FLOW_TYPE, TEST_TENANT_SLUG, TEST_PHONE_FROM } = process.env;

    // Si no hay variables de test, continuar normal
    if (!TEST_FLOW_TYPE) {
        return next();
    }

    // Validar que sea entorno de desarrollo
    if (process.env.NODE_ENV === 'production') {
        console.warn('[TEST MODE] Ignorado en producción');
        return next();
    }

    // Inyectar contexto forzado en el request
    req.testMode = {
        active: true,
        flowType: TEST_FLOW_TYPE, // 'cliente' | 'tenant' | 'onboard'
        tenantSlug: TEST_TENANT_SLUG || null,
        phoneFrom: TEST_PHONE_FROM || req.body?.from || '+56900000000',
        forcedAt: new Date().toISOString()
    };

    // Log para debugging
    console.log(`[TEST MODE] Flujo forzado: ${TEST_FLOW_TYPE}`, {
        tenantSlug: TEST_TENANT_SLUG,
        phoneFrom: req.testMode.phoneFrom
    });

    next();
};