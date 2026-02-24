export const formatDisponibilidad = (habitaciones) => {
    if (!habitaciones || habitaciones.length === 0) {
        return formatSinDisponibilidad();
    }

    const lines = habitaciones.map(h => {
        const precio = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(h.precio || h.precio_base || 0);
        const tipo = h.tipo || h.nombre || 'Habitación';
        const capacidad = h.capacidad ? ` (hasta ${h.capacidad} personas)` : '';
        return `• ${tipo} — ${precio}${capacidad}`;
    });

    return `Tenemos disponible:\n${lines.join('\n')}`;
};

export const formatPrecios = (precios) => {
    if (!precios || precios.length === 0) {
        return 'No tenemos información de precios disponible en este momento.';
    }

    const lines = precios.map(p => {
        const base = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(p.precio_base || 0);
        const fds = p.precio_fin_semana
            ? ` (fin de semana: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(p.precio_fin_semana)})`
            : '';
        return `• ${p.tipo || p.nombre} — ${base}${fds}`;
    });

    return `Nuestros precios:\n${lines.join('\n')}`;
};

export const formatReservaConfirmada = (reserva) => {
    const codigo = reserva.reservaId || reserva.confirmacion || reserva.id;
    const hab = reserva.habitacion ? ` en ${reserva.habitacion}` : '';
    return `¡Reserva confirmada! Tu código es #${codigo}${hab}. Te esperamos 🙌`;
};

export const formatSinDisponibilidad = () => {
    return 'Lo sentimos, no tenemos disponibilidad para esa fecha. ¿Te gustaría consultar otra fecha?';
};

export const formatErrorPMS = () => {
    return 'En este momento no podemos verificar disponibilidad. Te comunicamos con un ejecutivo para ayudarte.';
};
