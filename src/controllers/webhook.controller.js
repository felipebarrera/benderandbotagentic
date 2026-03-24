/**
 * Controlador principal de webhook WhatsApp
 * Versión con timeouts y fallback garantizado
 */

import { intentClassifier } from '../services/intent-classifier.service.js';
import { tenantResolver } from '../services/tenant-resolver.service.js';
import { handleTenantCustomerFlow } from '../flows/tenant-customer/index.js';
import { handleCentralOnboardingFlow } from '../flows/central-onboarding/index.js';

const RESPONSE_TIMEOUT_MS = 10000; // 10 segundos máximo para toda la request

export const handleWhatsAppWebhook = async (req, res) => {
  const requestStart = Date.now();

  // Timeout global para la request
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), RESPONSE_TIMEOUT_MS);
  });

  const mainLogic = async () => {
    try {
      console.log(`[WEBHOOK] Request iniciada`, {
        from: req.context?.from,
        to: req.context?.to,
        testMode: req.testMode?.active,
        path: req.path
      });

      const { body, context, testMode } = req;

      // === PASO 1: Clasificar intención ===
      console.log('[WEBHOOK] Iniciando clasificación...');

      let classification;
      try {
        classification = await intentClassifier.classify({
          message: context.body,
          context: {
            isCentralNumber: context.isCentralNumber,
            isTenantNumber: context.isTenantNumber,
            from: context.from,
            to: context.to
          },
          testFlowType: testMode?.flowType
        });
        console.log(`[WEBHOOK] Clasificación completada: ${classification.perfil}/${classification.intencion}`);
      } catch (classifyError) {
        console.error('[WEBHOOK] Error en clasificación:', classifyError.message);
        classification = {
          perfil: testMode?.flowType || (context.isCentralNumber ? 'onboard' : 'cliente'),
          intencion: 'info',
          confianza: 0.3,
          datos_extraer: {},
          fallback: true,
          error: classifyError.message
        };
      }

      // === PASO 2: Resolver tenant si aplica ===
      let tenantData = null;
      if (context.isTenantNumber && classification.perfil !== 'onboard') {
        try {
          // Timeout de 3 segundos para resolver tenant
          tenantData = await Promise.race([
            tenantResolver.findByPhone(context.to),
            new Promise((resolve) => setTimeout(() => resolve(null), 3000))
          ]);
        } catch (err) {
          console.warn('[WEBHOOK] Tenant resolver falló:', err.message);
        }

        if (!tenantData) {
          console.warn(`[WEBHOOK] Número ${context.to} no registrado como tenant`);
          return {
            status: 'ok',
            reply: 'Gracias por escribir. Este número no está configurado para recibir mensajes. ¿Necesitas ayuda con BenderAnd? Escribe al número central.',
            meta: { classification, test_mode: !!testMode?.active }
          };
        }
      }

      // === PASO 3: Enrutar al flujo correspondiente ===
      let response;
      try {
        if (classification.perfil === 'tenant' && tenantData) {
          response = await handleTenantCustomerFlow({
            tenant: tenantData,
            customerPhone: context.from,
            message: context.body,
            classification,
            testMode
          });
        } else if (classification.perfil === 'onboard' || context.isCentralNumber) {
          response = await handleCentralOnboardingFlow({
            customerPhone: context.from,
            message: context.body,
            classification,
            testMode
          });
        } else if (classification.perfil === 'cliente' && tenantData) {
          response = await handleTenantCustomerFlow({
            tenant: tenantData,
            customerPhone: context.from,
            message: context.body,
            classification,
            testMode
          });
        } else {
          response = {
            reply: `Hola 👋 Para ayudarte mejor, ¿me cuentas si eres:\n\n1️⃣ Cliente de un negocio\n2️⃣ Dueño de un negocio\n3️⃣ Quieres probar BenderAnd\n\nResponde con el número.`
          };
        }
      } catch (flowError) {
        console.error('[WEBHOOK] Error en flujo:', flowError);
        response = {
          reply: '⚠️ Hubo un error procesando tu mensaje. Por favor intenta nuevamente.'
        };
      }

      // === PASO 4: Retornar respuesta ===
      return {
        status: 'ok',
        ...response,
        meta: {
          classification,
          tenant_uuid: tenantData?.uuid,
          test_mode: !!testMode?.active,
          processing_time_ms: Date.now() - requestStart
        }
      };

    } catch (error) {
      console.error('[WEBHOOK] Error crítico:', error);
      return {
        status: 'error',
        reply: '⚠️ Error interno. Intenta nuevamente.',
        meta: { error: process.env.NODE_ENV === 'development' ? error.message : undefined }
      };
    }
  };

  // Ejecutar con timeout global
  try {
    const result = await Promise.race([mainLogic(), timeoutPromise]);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[WEBHOOK] Timeout o error fatal:', error.message);
    return res.status(500).json({
      status: 'error',
      reply: '⚠️ Tiempo de respuesta excedido. Intenta nuevamente.',
      meta: { error: error.message }
    });
  }
};