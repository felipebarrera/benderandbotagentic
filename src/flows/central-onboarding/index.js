/**
 * Flujo: Onboarding y Soporte Central (número superadmin)
 * Maneja: nuevos clientes, soporte a existentes, demo inmediata
 */

import { tenantResolver } from '../../services/tenant-resolver.service.js';

export const handleCentralOnboardingFlow = async ({ customerPhone, message, classification, testMode }) => {
    const { intencion, datos_extraer } = classification;

    // === CASO ESPECIAL: Cliente existente buscando credenciales ===
    if (intencion === 'credenciales' || /(contraseña|clave|acceder|login)/i.test(message)) {
        return handleExistingCustomerSupport({ customerPhone, message, datos_extraer });
    }

    // === Flujo principal de onboarding ===
    switch (intencion) {
        case 'onboarding':
        case 'demo':
            return handleNewCustomerOnboarding({ customerPhone, message, classification, testMode });

        case 'info':
            return handleCentralInfo({ message });

        case 'soporte':
            return handleCentralSupport({ customerPhone, message });

        default:
            return handleOnboardingWelcome({ customerPhone });
    }
};

const handleOnboardingWelcome = (customerPhone) => {
    return {
        reply: `🎉 *¡Bienvenido a BenderAnd!*\n\nSoy tu asistente para configurar tu empresa en minutos. Antes de empezar:\n\n❓ ¿Ya tienes cuenta en BenderAnd?\n\n✅ *Sí, soy cliente antiguo*\n🆕 *No, quiero ser cliente nuevo*\n\nResponde con la opción:`
    };
};

const handleExistingCustomerSupport = async ({ customerPhone, message, datos_extraer }) => {
    // === REGLA CRÍTICA: NUNCA recrear credenciales ===

    const rut = datos_extraer.rut;

    if (!rut) {
        return {
            reply: `🔐 *Recuperar acceso*\n\nPara ayudarte a recuperar tu cuenta, necesito tu RUT.\n\nPor favor, envíame tu RUT con formato:\n• 12.345.678-9\n• o 12345678-9\n\n_Este chat es seguro y tus datos están protegidos._`
        };
    }

    // TODO: Consultar ERP para verificar existencia del cliente
    // Por ahora, redirigir al flujo de recuperación del ERP

    return {
        reply: `✅ *Te reconocemos, ${datos_extraer.nombre || 'cliente'}*\n\nPara recuperar tu acceso de forma segura:\n\n🔗 Visita: https://app.benderand.cl/auth/recuperar\n📧 O revisa tu email registrado para el enlace de recuperación\n\n⚠️ *Importante:* Por seguridad, no podemos generar nuevas contraseñas por WhatsApp. Usa el enlace oficial para restablecer tu acceso.\n\n¿Necesitas ayuda con algo más?`
    };
};

const handleNewCustomerOnboarding = async ({ customerPhone, message, classification, testMode }) => {
    const { datos_extraer } = classification;
    const industria = datos_extraer.industria;

    // Si ya tenemos industria, saltar a captura de datos básicos
    if (industria) {
        return handleCaptureBasicData({ customerPhone, industria, testMode });
    }

    // Mostrar selector de industria
    return {
        reply: `🚀 *¡Excelente! Vamos a crear tu demo*\n\nPrimero, ¿a qué te dedicas?\n\n👨‍⚕️ *PROFESIONALES*\n1. Médico / Clínica\n2. Dentista\n3. Abogado / Legal\n4. Psicólogo / Terapeuta\n5. Gasfíter / Técnico\n6. Otro profesional\n\n🏢 *NEGOCIOS*\n7. Abarrotes / Retail\n8. Ferretería\n9. Restaurante / Delivery\n10. Motel / Hospedaje\n11. Canchas deportivas\n12. Otro negocio\n\n💡 *Responde con el número de tu opción:*`
    };
};

const handleCaptureBasicData = ({ customerPhone, industria, testMode }) => {
    // Mapeo de opción a industria
    const industriaMap = {
        '1': 'medico', '2': 'dentista', '3': 'legal', '4': 'psicologo', '5': 'gasfiter',
        '7': 'abarrotes', '8': 'ferreteria', '9': 'restaurante', '10': 'motel', '11': 'canchas'
    };

    const industriaKey = industriaMap[industria] || industria;

    // === DEMO INMEDIATA: Crear tenant y credenciales ===
    // En modo test, simular creación; en producción, llamar al ERP

    const demoSlug = `demo-${industriaKey}-${Date.now().toString().slice(-4)}`;
    const demoUrl = `https://${demoSlug}.benderand.cl`;
    const demoUser = `admin@${demoSlug}.cl`;
    const demoPass = testMode?.active ? 'demo1234' : generateSecurePassword();

    return {
        reply: `✅ *¡Tu demo de ${industriaKey} está lista!*\n\n🎉 BenderAnd se ha configurado automáticamente para tu industria.\n\n🔗 *Panel de control:*\n${demoUrl}\n\n👤 *Usuario:*\n${demoUser}\n\n🔑 *Contraseña:*\n${demoPass}\n\n⏱️ *Válida por 30 días*\n\n📋 *Próximos pasos:*\n1. Ingresa a tu panel con las credenciales\n2. Explora los módulos activados para ${industriaKey}\n3. Personaliza tu configuración\n4. Cuando estés listo, contrata tu plan\n\n💬 ¿Quieres que te guíe en el primer paso? Responde "sí" para comenzar.`,
        demo_created: {
            slug: demoSlug,
            url: demoUrl,
            user: demoUser,
            // password: demoPass // No retornar password en logs
            industry: industriaKey,
            trial_days: 30,
            test_mode: !!testMode?.active
        }
    };
};

const handleCentralInfo = ({ message }) => {
    return {
        reply: `📋 *BenderAnd ERP*\n\nPlataforma todo-en-uno para gestionar tu negocio:\n\n✅ Punto de venta (POS)\n✅ Inventario y compras\n✅ Facturación electrónica SII\n✅ WhatsApp bot integrado\n✅ RRHH y liquidaciones\n✅ Delivery y tracking\n✅ Y 25+ módulos más\n\n💰 *Planes desde $39.000/mes*\n🎁 *30 días de prueba gratis*\n\n¿Te gustaría activar tu demo ahora? Responde "demo" para comenzar.`
    };
};

const handleCentralSupport = ({ customerPhone, message }) => {
    return {
        reply: `🛟 *Soporte Central*\n\nHe registrado tu consulta:\n"${message}"\n\n📋 Ticket: #SUP-${Date.now().toString().slice(-6)}\n🕐 Tiempo estimado de respuesta: < 2 horas hábiles\n\nUn miembro del equipo BenderAnd te contactará por este chat. ¿Hay algo urgente en lo que pueda ayudarte mientras tanto?`
    };
};

// Helper: Generar contraseña segura
const generateSecurePassword = (length = 12) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};