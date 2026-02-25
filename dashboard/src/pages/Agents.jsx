import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Shield, Trash2, Edit } from 'lucide-react';

export default function Agents() {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const isAdmin = user?.rol === 'ADMIN';

    const fetchAgents = async () => {
        try {
            const { data } = await api.get('/agents');
            setAgents(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que deseas eliminar este agente?')) return;
        try {
            await api.delete(`/agents/${id}`);
            setAgents(agents.filter(a => a.id !== id));
        } catch (err) {
            alert(err.response?.data?.error || 'Error al eliminar');
        }
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Users size={28} /> Gestión de Agentes
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Administra el equipo de atención al cliente</p>
                </div>
                {isAdmin && (
                    <button className="btn btn-primary">
                        <UserPlus size={18} /> Nuevo Agente
                    </button>
                )}
            </header>

            <div className="glass-panel" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                            <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.9rem' }}>Nombre</th>
                            <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.9rem' }}>Email</th>
                            <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.9rem' }}>Rol</th>
                            <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.9rem' }}>Estado</th>
                            {isAdmin && <th style={{ padding: '16px', textAlign: 'right' }}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>Cargando...</td></tr>
                        ) : agents.map(agent => (
                            <tr key={agent.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <td style={{ padding: '16px', fontWeight: 500 }}>{agent.nombre}</td>
                                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{agent.email}</td>
                                <td style={{ padding: '16px' }}>
                                    <span className="badge" style={{
                                        background: agent.rol === 'ADMIN' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                        color: agent.rol === 'ADMIN' ? 'var(--primary)' : 'var(--info)'
                                    }}>
                                        {agent.rol}
                                    </span>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: agent.online ? 'var(--success)' : 'var(--text-muted)'
                                        }}></span>
                                        <span style={{ fontSize: '0.85rem', color: agent.online ? 'var(--success)' : 'var(--text-muted)' }}>
                                            {agent.online ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                </td>
                                {isAdmin && (
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button className="btn btn-outline" style={{ padding: '8px' }} title="Editar">
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(agent.id)}
                                                className="btn btn-danger"
                                                style={{ padding: '8px' }}
                                                title="Eliminar"
                                                disabled={agent.id === user.id} // Prevents deleting oneself
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {agents.length === 0 && !loading && (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay agentes registrados</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
