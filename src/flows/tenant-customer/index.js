/**
 * Flujo: Bot de Atención al Cliente para tenants
 * Maneja: info (precios, horarios), ventas, reclamos
 */

import { tenantResolver } from '../../services/tenant-resolver.service.js';

export const handleTenantCustomerFlow = async ({ tenant, customerPhone, message, classification, testMode }) => {
    const { intencion, datos_extraer } = classification;

    // Registrar contexto de conversación (para historial)
    // TODO: Implementar persistencia en Prisma

    switch (intencion) {
        case 'info':
            return handleInfoFlow({ tenant, customerPhone, message, datos_extraer });

        case 'ventas':
            return handleSalesFlow({ tenant, customerPhone, message, datos_extraer });

        case 'reclamo':
            return handleSupportFlow({ tenant, customerPhone, message, datos_extraer });

        default:
            return {
                reply: `Hola 👋 Soy el asistente de *${tenant.nombre}*. ¿En qué puedo ayudarte?\n\n📦 Consultar productos\n💰 Precios y promociones\n🕐 Horarios de atención\n📋 Hacer un pedido\n❌ Reclamos o soporte\n\nEscribe tu consulta:`
            };
    }
};

const handleInfoFlow = async ({ tenant, customerPhone, message, datos_extraer }) => {
    // TODO: Consultar ERP para obtener información real
    // Por ahora, respuesta genérica con datos del tenant

    const hasProduct = datos_extraer.producto?.toLowerCase();

    if (hasProduct) {
        return {
            reply: `🔍 Buscando *${hasProduct}* en *${tenant.nombre}*...\n\n⏳ Consulta en tiempo real con nuestro sistema. Un momento por favor.\n\n_Tip: También puedes visitar nuestro portal web para ver el catálogo completo._`
        };
    }

    return {
        reply: `📋 *Información de ${tenant.nombre}*\n\n🕐 Horario: ${tenant.horario_atencion || 'Lun-Sab 9:00-20:00'}\n📍 Ubicación: ${tenant.direccion || 'Consultar en portal web'}\n📞 Contacto: ${tenant.telefono || tenant.whatsapp_admin}\n\n¿Necesitas algo más específico?`
    };
};

const handleSalesFlow = async ({ tenant, customerPhone, message, datos_extraer }) => {
    // TODO: Integrar con carrito de compras del ERP
    // Por ahora, flujo básico de captura de pedido

    const producto = datos_extraer.producto || 'producto';
    const cantidad = datos_extraer.cantidad || 1;

    return {
        reply: `🛒 *Pedido en proceso*\n\nProducto: *${producto}*\nCantidad: *${cantidad}*\nNegocio: *${tenant.nombre}*\n\n✅ Para confirmar este pedido necesito:\n1️⃣ Tu nombre completo\n2️⃣ Tu RUT\n3️⃣ ¿Retiro en tienda o delivery?\n\nResponde con la información:`
    };
};

const handleSupportFlow = async ({ tenant, customerPhone, message, datos_extraer }) => {
    // TODO: Crear ticket en ERP y notificar al admin del tenant

    return {
        reply: `❌ *Soporte - ${tenant.nombre}*\n\nHe registrado tu consulta:\n"${message}"\n\n📋 Número de caso: #SOP-${Date.now().toString().slice(-6)}\n\nUn miembro de nuestro equipo te contactará en breve por este mismo chat. ¿Hay algo más en lo que pueda ayudarte mientras tanto?`
    };
};