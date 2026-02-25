import { useState, useEffect } from 'react';
import api from '../services/api';
import useSocket from '../hooks/useSocket';
import { Users, Bot, MessageCircle, Clock, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'var(--primary)', highlight = false }) => (
    <div className="glass-panel" style={{
        padding: '24px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        border: highlight ? `1px solid ${color}` : undefined,
        boxShadow: highlight ? `0 0 20px ${color}20` : undefined
    }}>
        <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 500 }}>{title}</p>
            <h3 style={{ fontSize: '2rem', color: highlight ? color : 'var(--text-main)', margin: 0, lineHeight: 1 }}>{value}</h3>
            {subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', margin: 0 }}>{subtitle}</p>}
        </div>
        <div style={{
            padding: '12px',
            background: `${color}15`,
            borderRadius: 'var(--radius-md)',
            color: color
        }}>
            <Icon size={24} />
        </div>
    </div>
);

export default function Dashboard() {
    const [metrics, setMetrics] = useState(null);
    const [realtime, setRealtime] = useState({ conversaciones_activas: 0, cola_actual: 0, agentes_online: 0 });
    const [loading, setLoading] = useState(true);
    const { subscribe } = useSocket();

    const fetchMetrics = async () => {
        try {
            const [metricsRes, realtimeRes] = await Promise.all([
                api.get('/dashboard/metrics?periodo=hoy'),
                api.get('/dashboard/realtime')
            ]);
            setMetrics(metricsRes.data);
            setRealtime(realtimeRes.data);
        } catch (err) {
            console.error('Error fetching metrics', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 30000); // Polling cada 30s de respaldo
        return () => clearInterval(interval);
    }, []);

    // WebSockets para actualizar realtime instantáneamente cuando hay eventos
    useEffect(() => {
        const unsubConv = subscribe('conversation_update', () => { fetchMetrics() });
        const unsubMsg = subscribe('new_message', () => { fetchMetrics() });
        return () => { unsubConv(); unsubMsg(); };
    }, [subscribe]);

    if (loading || !metrics) {
        return <div className="animate-fade-in"><p style={{ color: 'var(--text-muted)' }}>Cargando métricas...</p></div>;
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ color: 'var(--primary)', marginBottom: '4px' }}>Monitor en Vivo</h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Resumen de actividad de hoy</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                        width: '10px', height: '10px',
                        borderRadius: '50%', background: 'var(--success)',
                        boxShadow: '0 0 10px var(--success)'
                    }}></span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Conectado (Live)</span>
                </div>
            </header>

            {/* Primary Realtime Stats */}
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--primary)" /> Tiempo Real
            </h3>
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px', marginBottom: '40px'
            }}>
                <StatCard
                    title="Conversaciones Activas" value={realtime.conversaciones_activas}
                    icon={MessageCircle} color="var(--info)" highlight={realtime.conversaciones_activas > 0}
                />
                <StatCard
                    title="Clientes en Cola" value={realtime.cola_actual}
                    icon={Clock} color={realtime.cola_actual > 0 ? "var(--warning)" : "var(--success)"}
                    highlight={realtime.cola_actual > 0}
                    subtitle="Esperando atención humana"
                />
                <StatCard
                    title="Agentes Online" value={realtime.agentes_online}
                    icon={Users} color="var(--success)"
                />
            </div>

            {/* Daily Metrics */}
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)' }}>Métricas del Día</h3>
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '24px'
            }}>
                <StatCard
                    title="Mensajes Totales" value={metrics.mensajes_totales}
                    icon={MessageCircle} color="var(--text-muted)"
                />
                <StatCard
                    title="Resolución por IA" value={`${metrics.tasa_resolucion_bot}%`}
                    icon={Bot} color="var(--primary)"
                    subtitle={`${metrics.conversaciones_bot} de ${metrics.conversaciones_totales} resueltos sin ayuda`}
                />
                <StatCard
                    title="Derivados a Humano" value={metrics.conversaciones_humano}
                    icon={AlertTriangle} color="var(--warning)"
                />
                <StatCard
                    title="Conversaciones Totales" value={metrics.conversaciones_totales}
                    icon={CheckCircle2} color="var(--info)"
                />
            </div>
        </div>
    );
}
