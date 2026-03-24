/**
 * Flujo: Bot de Atención al Cliente para tenants
 * Maneja: info (precios, horarios), ventas, reclamos
 * 
 * Referencia: BENDERAND_CONFIG_INDUSTRIAS.md para presets por industria
 */

export const handleTenantCustomerFlow = async ({ tenant, customerPhone, message, classification, testMode }) => {
    const { intencion, datos_extraer } = classification;

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
    const hasProduct = datos_extraer.producto?.toLowerCase();

    if (hasProduct) {
        return {
            reply: `🔍 Buscando *${hasProduct}* en *${tenant.nombre}*...\n\n⏳ Consulta en tiempo real con nuestro sistema. Un momento por favor.\n\n_Tip: También puedes visitar tu portal web para ver el catálogo completo._`
        };
    }

    // Usar datos del tenant config si existen
    const horario = tenant.config_bot?.horario || tenant.rubro_config?.horario_atencion || 'Lun-Sab 9:00-20:00';
    const direccion = tenant.config_bot?.direccion || tenant.direccion || 'Consultar en portal web';

    return {
        reply: `📋 *Información de ${tenant.nombre}*\n\n🕐 Horario: ${horario}\n📍 Ubicación: ${direccion}\n📞 Contacto: ${tenant.whatsapp_admin}\n\n¿Necesitas algo más específico?`
    };
};

const handleSalesFlow = async ({ tenant, customerPhone, message, datos_extraer }) => {
    const producto = datos_extraer.producto || 'producto';
    const cantidad = datos_extraer.cantidad || 1;

    return {
        reply: `🛒 *Pedido en proceso*\n\nProducto: *${producto}*\nCantidad: *${cantidad}*\nNegocio: *${tenant.nombre}*\n\n✅ Para confirmar este pedido necesito:\n1️⃣ Tu nombre completo\n2️⃣ Tu RUT\n3️⃣ ¿Retiro en tienda o delivery?\n\nResponde con la información:`
    };
};

const handleSupportFlow = async ({ tenant, customerPhone, message, datos_extraer }) => {
    return {
        reply: `❌ *Soporte - ${tenant.nombre}*\n\nHe registrado tu consulta:\n"${message}"\n\n📋 Número de caso: #SOP-${Date.now().toString().slice(-6)}\n\nUn miembro de nuestro equipo te contactará en breve por este mismo chat. ¿Hay algo más en lo que pueda ayudarte mientras tanto?`
    };
};