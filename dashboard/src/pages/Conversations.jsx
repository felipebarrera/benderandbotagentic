import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import useSocket from '../hooks/useSocket';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, UserCircle, Bot, HandMetal, CheckCircle } from 'lucide-react';

export default function Conversations() {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingConv, setLoadingConv] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [inputMsg, setInputMsg] = useState('');

    const { subscribe } = useSocket();
    const messagesEndRef = useRef(null);

    // 1. Fetch Conversations
    const fetchConversations = async () => {
        try {
            const { data } = await api.get('/conversations?estado=todas');
            setConversations(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingConv(false);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    // 2. Fetch Messages when conv selected
    useEffect(() => {
        if (!selectedConv) return;
        const fetchMsgs = async () => {
            setLoadingMsgs(true);
            try {
                const { data } = await api.get(`/conversations/${selectedConv.id}/messages?limit=100`);
                setMessages(data.data.reverse()); // Asumiendo que vienen decendentes de la API
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingMsgs(false);
            }
        };
        fetchMsgs();
    }, [selectedConv?.id]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 3. WebSockets Events
    useEffect(() => {
        const unsubConv = subscribe('conversation_update', (updatedConv) => {
            setConversations(prev => {
                const idx = prev.findIndex(c => c.id === updatedConv.id);
                if (idx === -1) return [updatedConv, ...prev];
                const newArr = [...prev];
                newArr[idx] = updatedConv;
                return newArr.sort((a, b) => new Date(b.ultimo_mensaje_at) - new Date(a.ultimo_mensaje_at));
            });
            if (selectedConv?.id === updatedConv.id) {
                setSelectedConv(updatedConv);
            }
        });

        const unsubMsg = subscribe('new_message', (newMsg) => {
            if (selectedConv?.id === newMsg.conversacion_id) {
                setMessages(prev => {
                    if (prev.find(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
            }
            fetchConversations(); // Para actualizar los badges temporales en la lista
        });

        return () => { unsubConv(); unsubMsg(); };
    }, [subscribe, selectedConv]);

    // Actions
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMsg.trim() || !selectedConv) return;
        try {
            await api.post(`/conversations/${selectedConv.id}/messages`, { contenido: inputMsg });
            setInputMsg('');
            // Optimistic UI update could go here, but WS handles it immediately
        } catch (err) {
            console.error(err);
        }
    };

    const handleResolveHandover = async (resolucion) => {
        try {
            await api.post(`/handover/${selectedConv.id}/resolve`, { resolucion });
        } catch (err) {
            console.error(err);
        }
    };

    const handleChangeState = async (newState) => {
        try {
            await api.patch(`/conversations/${selectedConv.id}`, { estado: newState });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 64px)', gap: '24px' }}>
            {/* Sidebar List */}
            <div className="glass-panel" style={{ width: '350px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)' }}>
                    <h2 style={{ fontSize: '1.2rem', color: 'var(--text-main)', margin: 0 }}>Chats Activos</h2>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loadingConv ? <p style={{ padding: '20px', textAlign: 'center' }}>Cargando...</p> :
                        conversations.map(conv => (
                            <div
                                key={conv.id}
                                onClick={() => setSelectedConv(conv)}
                                style={{
                                    padding: '16px 20px',
                                    borderBottom: '1px solid var(--glass-border)',
                                    cursor: 'pointer',
                                    background: selectedConv?.id === conv.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    transition: 'background 0.2s',
                                    borderLeft: selectedConv?.id === conv.id ? '3px solid var(--primary)' : '3px solid transparent'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{conv.contact_name || conv.whatsapp_contact}</h4>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {format(new Date(conv.ultimo_mensaje_at), 'HH:mm')}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                                        {conv.whatsapp_contact}
                                    </span>

                                    <span className={`badge badge-${conv.estado.toLowerCase()}`}>
                                        {conv.estado === 'BOT' ? <Bot size={12} style={{ marginRight: '4px' }} /> :
                                            conv.estado === 'HUMANO' ? <UserCircle size={12} style={{ marginRight: '4px' }} /> : null}
                                        {conv.estado}
                                    </span>
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            {/* Main Chat Window */}
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {!selectedConv ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <MessageCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <p>Selecciona una conversación para comenzar</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>{selectedConv.contact_name || selectedConv.whatsapp_contact}</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Atendida por: {selectedConv.agente?.nombre || (selectedConv.estado === 'BOT' ? 'Piloto Automático (Bot)' : 'Nadie asignado')}
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                {selectedConv.estado === 'BOT' && (
                                    <button onClick={() => handleChangeState('HUMANO')} className="btn btn-outline" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                                        <HandMetal size={16} /> Tomar Control Manual
                                    </button>
                                )}
                                {selectedConv.estado === 'HUMANO' && (
                                    <>
                                        <button onClick={() => handleResolveHandover('tomado')} className="btn btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                                            Asumir (Quitar Timeout)
                                        </button>
                                        <button onClick={() => handleChangeState('BOT')} className="btn btn-outline" style={{ borderColor: 'var(--info)', color: 'var(--info)' }}>
                                            <Bot size={16} /> Devolver al Bot
                                        </button>
                                    </>
                                )}
                                <button onClick={() => handleChangeState('CERRADA')} className="btn btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                                    <CheckCircle size={16} /> Cerrar Caso
                                </button>
                            </div>
                        </div>

                        {/* Chat Messages */}
                        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {loadingMsgs ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Cargando mensajes...</p> :
                                messages.map(msg => {
                                    const isIncoming = msg.direccion === 'ENTRANTE';
                                    return (
                                        <div key={msg.id} style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: isIncoming ? 'flex-start' : 'flex-end',
                                            maxWidth: '85%',
                                            alignSelf: isIncoming ? 'flex-start' : 'flex-end'
                                        }}>
                                            <div style={{
                                                background: msg.tipo === 'SISTEMA' ? 'rgba(255,255,255,0.05)' :
                                                    isIncoming ? 'rgba(30, 41, 59, 0.9)' : 'var(--primary)',
                                                color: msg.tipo === 'SISTEMA' ? 'var(--text-muted)' :
                                                    isIncoming ? 'var(--text-main)' : 'var(--bg-darker)',
                                                padding: '12px 16px',
                                                borderRadius: '16px',
                                                borderBottomLeftRadius: isIncoming ? '4px' : '16px',
                                                borderBottomRightRadius: isIncoming ? '16px' : '4px',
                                                border: isIncoming ? '1px solid var(--glass-border)' : 'none',
                                                boxShadow: isIncoming ? 'var(--glass-shadow)' : '0 4px 14px var(--primary-glow)',
                                                fontSize: msg.tipo === 'SISTEMA' ? '0.85rem' : '0.95rem',
                                                fontStyle: msg.tipo === 'SISTEMA' ? 'italic' : 'normal'
                                            }}>
                                                {msg.contenido}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', padding: '0 4px' }}>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {format(new Date(msg.created_at), 'dd MMM HH:mm', { locale: es })}
                                                </span>
                                                {msg.intent_detected && msg.intent_detected !== 'null' && (
                                                    <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {msg.intent_detected}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div style={{ padding: '20px', borderTop: '1px solid var(--glass-border)', background: 'rgba(15, 23, 42, 0.4)' }}>
                            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px' }}>
                                <input
                                    type="text"
                                    className="input"
                                    style={{ flex: 1, margin: 0 }}
                                    placeholder="Escribe un mensaje al cliente..."
                                    value={inputMsg}
                                    onChange={(e) => setInputMsg(e.target.value)}
                                    disabled={selectedConv.estado === 'CERRADA'}
                                />
                                <button type="submit" className="btn btn-primary" disabled={!inputMsg.trim() || selectedConv.estado === 'CERRADA'}>
                                    <Send size={18} />
                                </button>
                            </form>
                            {selectedConv.estado === 'CERRADA' && (
                                <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--danger)', textAlign: 'center' }}>
                                    Esta conversación está cerrada. Ábrela de nuevo (Tomar Control) para enviar mensajes.
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
