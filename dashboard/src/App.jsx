import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Lazy loading pages (implementadas en Wave 3)
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import Agents from './pages/Agents';
import Settings from './pages/Settings';
import Superadmin from './pages/Superadmin';
import Layout from './components/Layout';

const PrivateRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                <h2 style={{ color: 'var(--primary)' }}>Cargando Panel...</h2>
            </div>
        </div>
    );

    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="conversations" element={<Conversations />} />
                <Route path="agents" element={<Agents />} />
                <Route path="settings" element={<Settings />} />
                <Route path="settings" element={<Settings />} />
                <Route path="superadmin" element={<Superadmin />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}

export default App;
