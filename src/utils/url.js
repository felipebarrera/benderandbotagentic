/**
 * src/utils/url.js
 * Detecta la URL base de la app desde el request entrante.
 * Funciona en local, ngrok y VPS con nginx/HestiaCP sin configuración extra.
 */

/**
 * Retorna la URL base desde la que se está sirviendo la app.
 * @param {import('express').Request} [req] - Request de Express (opcional)
 * @returns {string} URL base, ej: "https://abc123.ngrok-free.app" o "http://localhost:3001"
 */
export function getAppUrl(req) {
    if (req) {
        const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim()
                   || req.protocol
                   || 'http';
        const host  = req.headers['x-forwarded-host']?.split(',')[0].trim()
                   || req.headers.host
                   || 'localhost:3001';
        return `${proto}://${host}`;
    }
    // Fallback para CLIs y scripts sin request (onboard-tenant, seeds, etc.)
    return process.env.APP_URL || 'http://localhost:8080';
}

/**
 * Retorna la URL del dashboard (frontend).
 * En prod el frontend y la API pueden estar en hosts distintos.
 * @param {import('express').Request} [req]
 * @returns {string}
 */
export function getDashboardUrl(req) {
    // Si hay una variable explícita para el dashboard, usarla
    if (process.env.DASHBOARD_URL) return process.env.DASHBOARD_URL;
    // Si no, asumir mismo host que la API (setup típico con nginx)
    return getAppUrl(req);
}