import { useState, useEffect } from 'react';
import api from '../services/api';
import { Settings as SettingsIcon, Save, Bot, MessageSquare } from 'lucide-react';

export default function Settings() {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testMode, setTestMode] = useState(false);
    const [testMsg, setTestMsg] = useState('');

    const fetchConfig = async () => {
        try {
            const { data } = await api.get('/tenants/me');
            setConfig(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.patch('/tenants/me', config);
            alert('Configuración guardada exitosamente');
        } catch (err) {
            alert(err.response?.data?.error || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleTestBot = async () => {
        if (!testMsg) return;
        try {
            await api.post('/tenants/me/test-bot', { mensaje: testMsg });
            alert('Mensaje enviado. Revisa tu WhatsApp!');
            setTestMsg('');
        } catch (err) {
            alert(err.response?.data?.error || 'Error al enviar test');
        }
    };

    if (loading || !config) return <div className="animate-fade-in"><p style={{ color: 'var(--text-muted)' }}>Cargando...</p></div>;

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{ color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <SettingsIcon size={28} /> Configuración del Negocio
                </h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Modifica el comportamiento del bot y los ajustes de tu cuenta ({config.nombre})</p>
            </header>

            <div className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Bot size={20} color="var(--primary)" /> Comportamiento de IA
                </h3>

                <form onSubmit={handleSave}>
                    <div className="input-group">
                        <label>Modo Piloto Automático (Bot Atiende Primero)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', marginBottom: '16px' }}>
                            <label
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                    padding: '12px 20px', background: config.modo_bot ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${config.modo_bot ? 'var(--info)' : 'var(--glass-border)'}`,
                                    borderRadius: 'var(--radius-md)', transition: 'var(--transition)'
                                }}
                            >
                                <input
                                    type="radio" name="modo_bot"
                                    checked={config.modo_bot}
                                    onChange={() => setConfig({ ...config, modo_bot: true })}
                                />
                                <span style={{ color: config.modo_bot ? 'var(--info)' : 'var(--text-muted)' }}>Activado (IA Responde)</span>
                            </label>

                            <label
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                    padding: '12px 20px', background: !config.modo_bot ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${!config.modo_bot ? 'var(--danger)' : 'var(--glass-border)'}`,
                                    borderRadius: 'var(--radius-md)', transition: 'var(--transition)'
                                }}
                            >
                                <input
                                    type="radio" name="modo_bot"
                                    checked={!config.modo_bot}
                                    onChange={() => setConfig({ ...config, modo_bot: false })}
                                />
                                <span style={{ color: !config.modo_bot ? 'var(--danger)' : 'var(--text-muted)' }}>Desactivado (Solo Humano)</span>
                            </label>
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Prompt Analítico (Instrucciones para GPT)</label>
                        <textarea
                            className="input"
                            rows="4"
                            value={config.prompt_personalizado || ''}
                            onChange={(e) => setConfig({ ...config, prompt_personalizado: e.target.value })}
                            placeholder="Ej: Eres el asistente del Motel X. Responde siempre de forma amable..."
                            style={{ padding: '16px', resize: 'vertical' }}
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Define la personalidad del bot y reglas específicas de tu motel.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="input-group">
                            <label>Horario Inicio Atención</label>
                            <input
                                type="time" className="input"
                                value={config.horario_inicio}
                                onChange={(e) => setConfig({ ...config, horario_inicio: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label>Horario Fin Atención</label>
                            <input
                                type="time" className="input"
                                value={config.horario_fin}
                                onChange={(e) => setConfig({ ...config, horario_fin: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Telegram Chat ID (Notificaciones de Handover)</label>
                        <input
                            type="text" className="input"
                            value={config.telegram_chat_id || ''}
                            onChange={(e) => setConfig({ ...config, telegram_chat_id: e.target.value })}
                        />
                    </div>

                    <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="glass-panel" style={{ padding: '32px' }}>
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <MessageSquare size={20} color="var(--success)" /> Probar Conexión WhatsApp
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                    Envíate un mensaje de prueba al número matriz ({config.whatsapp_number}) para asegurar que la API de Meta está operativa.
                </p>

                {testMode ? (
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                            type="text" className="input" style={{ flex: 1 }}
                            placeholder="Escribe un mensaje..."
                            value={testMsg}
                            onChange={(e) => setTestMsg(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={handleTestBot}>Enviar</button>
                        <button className="btn btn-outline" onClick={() => setTestMode(false)}>Cancelar</button>
                    </div>
                ) : (
                    <button className="btn btn-outline" onClick={() => setTestMode(true)}>
                        Realizar prueba de envío
                    </button>
                )}
            </div>
        </div>
    );
}
