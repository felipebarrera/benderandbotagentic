/**
 * Controlador principal de webhook WhatsApp
 * Implementa enrutamiento inteligente por tipo de número y clasificación de intención
 */

import { intentClassifier } from '../services/intent-classifier.service.js';
import { tenantResolver } from '../services/tenant-resolver.service.js';
import { handleTenantCustomerFlow } from '../flows/tenant-customer/index.js';
import { handleCentralOnboardingFlow } from '../flows/central-onboarding/index.js';

export const handleWhatsAppWebhook = async (req, res) => {
  try {
    const { body, context, testMode } = req;

    // === PASO 1: Clasificar intención ===
    const classification = await intentClassifier.classify({
      message: context.body,
      context: {
        isCentralNumber: context.isCentralNumber,
        isTenantNumber: context.isTenantNumber,
        from: context.from,
        to: context.to
      },
      testFlowType: testMode?.flowType
    });

    console.log(`[WEBHOOK] Clasificación: ${classification.perfil}/${classification.intencion} (conf: ${classification.confianza})`);

    // === PASO 2: Resolver tenant si aplica ===
    let tenantData = null;
    if (context.isTenantNumber && classification.perfil !== 'onboard') {
      tenantData = await tenantResolver.findByPhone(context.to);
      if (!tenantData) {
        console.warn(`[WEBHOOK] Número ${context.to} no registrado como tenant`);
        // Fallback: tratar como número desconocido
        return res.status(200).json({
          status: 'ok',
          reply: 'Gracias por escribir. Este número no está configurado para recibir mensajes. ¿Necesitas ayuda con BenderAnd? Escribe al número central.'
        });
      }
    }

    // === PASO 3: Enrutar al flujo correspondiente ===
    let response;

    if (classification.perfil === 'tenant' && tenantData) {
      // Flujo: Bot de Atención al Cliente del Tenant
      response = await handleTenantCustomerFlow({
        tenant: tenantData,
        customerPhone: context.from,
        message: context.body,
        classification,
        testMode
      });

    } else if (classification.perfil === 'onboard' || context.isCentralNumber) {
      // Flujo: Onboarding / Soporte Central
      response = await handleCentralOnboardingFlow({
        customerPhone: context.from,
        message: context.body,
        classification,
        testMode
      });

    } else if (classification.perfil === 'cliente' && tenantData) {
      // Cliente de tenant (caso genérico)
      response = await handleTenantCustomerFlow({
        tenant: tenantData,
        customerPhone: context.from,
        message: context.body,
        classification,
        testMode
      });

    } else {
      // Fallback: preguntar contexto
      response = {
        reply: `Hola 👋 Para ayudarte mejor, ¿me cuentas si eres:\n\n1️⃣ Cliente de un negocio\n2️⃣ Dueño de un negocio\n3️⃣ Quieres probar BenderAnd\n\nResponde con el número.`
      };
    }

    // === PASO 4: Retornar respuesta ===
    return res.status(200).json({
      status: 'ok',
      ...response,
      metadata: {
        classification,
        tenant_uuid: tenantData?.uuid,
        test_mode: !!testMode?.active
      }
    });

  } catch (error) {
    console.error('[WEBHOOK] Error crítico:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Error procesando mensaje',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
  /**
 * Función de enrutamiento inteligente - integrar en handleWhatsAppWebhook existente
 */
  const routeMessage = async ({ context, classification, testMode }) => {
    const { tenantResolver } = await import('../services/tenant-resolver.service.js');
    const { handleTenantCustomerFlow } = await import('../flows/tenant-customer/index.js');
    const { handleCentralOnboardingFlow } = await import('../flows/central-onboarding/index.js');

    // Resolver tenant si aplica
    let tenantData = null;
    if (context.isTenantNumber && classification.perfil !== 'onboard') {
      tenantData = await tenantResolver.findByPhone(context.to);
      if (!tenantData) {
        return {
          reply: 'Gracias por escribir. Este número no está configurado para recibir mensajes. ¿Necesitas ayuda con BenderAnd? Escribe al número central.'
        };
      }
    }

    // Enrutar por perfil clasificado
    if (classification.perfil === 'tenant' && tenantData) {
      return await handleTenantCustomerFlow({
        tenant: tenantData,
        customerPhone: context.from,
        message: context.body,
        classification,
        testMode
      });
    }

    if (classification.perfil === 'onboard' || context.isCentralNumber) {
      return await handleCentralOnboardingFlow({
        customerPhone: context.from,
        message: context.body,
        classification,
        testMode
      });
    }

    if (classification.perfil === 'cliente' && tenantData) {
      return await handleTenantCustomerFlow({
        tenant: tenantData,
        customerPhone: context.from,
        message: context.body,
        classification,
        testMode
      });
    }

    // Fallback: preguntar contexto
    return {
      reply: `Hola 👋 Para ayudarte mejor, ¿me cuentas si eres:\n\n1️⃣ Cliente de un negocio\n2️⃣ Dueño de un negocio\n3️⃣ Quieres probar BenderAnd\n\nResponde con el número.`
    };
  };
};