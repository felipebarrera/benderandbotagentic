import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, MessageCircle, Users, Settings, LogOut } from 'lucide-react';

export default function Layout() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        { path: '/dashboard', label: 'Monitor', icon: LayoutDashboard },
        { path: '/conversations', label: 'Conversaciones', icon: MessageCircle },
        { path: '/agents', label: 'Agentes', icon: Users },
        { path: '/settings', label: 'Configuración', icon: Settings },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <aside className="glass-panel" style={{
                width: 'var(--sidebar-width)',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: 'none',
                borderTop: 'none',
                borderBottom: 'none',
                borderRadius: 0,
                position: 'fixed',
                height: '100vh',
                zIndex: 50
            }}>
                <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '2rem' }}>🏨</div>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)', margin: 0 }}>Moteland</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Panel IA</p>
                    </div>
                </div>

                <nav style={{ flex: 1, padding: '20px 12px' }}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: '8px',
                                    color: isActive ? '#fff' : 'var(--text-muted)',
                                    background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                    fontWeight: isActive ? 600 : 500,
                                    transition: 'var(--transition)'
                                }}
                            >
                                <Icon size={20} color={isActive ? 'var(--primary)' : 'currentColor'} />
                                {item.label}
                            </NavLink>
                        );
                    })}
                </nav>

                <div style={{ padding: '24px', borderTop: '1px solid var(--glass-border)' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{user?.nombre}</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</p>
                        <span className="badge" style={{
                            background: 'rgba(251, 191, 36, 0.2)',
                            color: 'var(--primary)',
                            marginTop: '8px',
                            display: 'inline-block'
                        }}>
                            {user?.rol}
                        </span>
                    </div>
                    <button
                        onClick={logout}
                        className="btn btn-outline"
                        style={{ width: '100%', color: 'var(--text-muted)' }}
                    >
                        <LogOut size={16} /> Salir
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{
                flex: 1,
                marginLeft: 'var(--sidebar-width)',
                padding: '32px',
                overflowY: 'auto',
                height: '100vh',
                position: 'relative'
            }}>
                <Outlet />
            </main>
        </div>
    );
}
