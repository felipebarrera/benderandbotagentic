import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Login() {
    const { login, isAuthenticated } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await login(email, password);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div className="glass-panel animate-fade-in" style={{
                padding: '40px',
                width: '100%',
                maxWidth: '420px',
                textAlign: 'center'
            }}>
                <div style={{ marginBottom: '32px' }}>
                    <div style={{
                        fontSize: '3rem',
                        marginBottom: '10px'
                    }}>🏨</div>
                    <h1 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Moteland</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Panel de Administración IA</p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--danger)',
                        color: 'var(--danger)',
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '20px',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                    <div className="input-group">
                        <label>Correo Electrónico</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="admin@motel.cl"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            className="input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '20px', height: '48px' }}
                        disabled={loading}
                    >
                        {loading ? 'Iniciando sesión...' : 'Ingresar al Dashboard'}
                    </button>
                </form>

                <p style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Acceso exclusivo para administradores
                </p>
            </div>
        </div>
    );
}
