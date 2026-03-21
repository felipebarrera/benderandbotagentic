import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Server, Activity, Power, PowerOff, Building } from 'lucide-react';

export default function Superadmin() {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        const fetchTenants = async () => {
            try {
                const { data } = await api.get('/superadmin/tenants');
                setTenants(data);
            } catch (err) {
                console.error('Error fetching tenants', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTenants();
    }, []);

    const toggleStatus = async (id, currentStatus) => {
        if (!confirm(`¿Seguro que deseas ${currentStatus ? 'desactivar' : 'activar'} este tenant?`)) return;
        try {
            const { data } = await api.patch(`/superadmin/tenants/${id}/status`, { activo: !currentStatus });
            setTenants(tenants.map(t => t.id === id ? { ...t, activo: data.activo } : t));
        } catch (err) {
            alert(err.response?.data?.error || 'Error al actualizar');
        }
    };

    if (user?.rol !== 'SUPERADMIN') {
        return (
            <div className="animate-fade-in" style={{ textAlign: 'center', marginTop: '40px' }}>
                <Shield size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
                <h2 style={{ color: 'var(--danger)' }}>Acceso Denegado</h2>
                <p style={{ color: 'var(--text-muted)' }}>Esta sección es exclusiva para Super Administradores del sistema.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ color: 'var(--warning)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Server size={28} /> Panel Super Admin
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Gestión global de Tenants e Infraestructura</p>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info)', borderRadius: 'var(--radius-md)' }}>
                        <Building size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>Total Tenants</p>
                        <h3 style={{ fontSize: '1.8rem', color: 'var(--text-main)', margin: 0 }}>{tenants.length}</h3>
                    </div>
                </div>
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: 'var(--radius-md)' }}>
                        <Activity size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>Tenants Activos</p>
                        <h3 style={{ fontSize: '1.8rem', color: 'var(--text-main)', margin: 0 }}>{tenants.filter(t => t.activo).length}</h3>
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                            <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>Tenant</th>
                            <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>WhatsApp</th>
                            <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>Agentes</th>
                            <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>Conversaciones</th>
                            <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>Estado</th>
                            <th style={{ padding: '16px', textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center' }}>Cargando métricas del sistema...</td></tr>
                        ) : tenants.map(t => (
                            <tr key={t.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <td style={{ padding: '16px' }}>
                                    <p style={{ margin: 0, fontWeight: 600 }}>{t.nombre}</p>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {t.id.split('-')[0]}...</p>
                                </td>
                                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{t.whatsapp_number}</td>
                                <td style={{ padding: '16px' }}>{t._count.agentes}</td>
                                <td style={{ padding: '16px' }}>{t._count.conversaciones}</td>
                                <td style={{ padding: '16px' }}>
                                    <span className="badge" style={{
                                        background: t.activo ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: t.activo ? 'var(--success)' : 'var(--danger)'
                                    }}>
                                        {t.activo ? 'Operativo' : 'Suspendido'}
                                    </span>
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                    <button
                                        onClick={() => toggleStatus(t.id, t.activo)}
                                        className={`btn ${t.activo ? 'btn-danger' : 'btn-outline'}`}
                                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                    >
                                        {t.activo ? <><PowerOff size={14} /> Suspender</> : <><Power size={14} /> Reactivar</>}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
