import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

export const useSocket = () => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('accessToken');

        if (!token) {
            setIsConnected(false);
            return;
        }

        socketRef.current = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'], // Fallback a polling si ws falla (Vite proxy a veces molesta con ws)
            reconnectionAttempts: 5,
            reconnectionDelay: 2000
        });

        socketRef.current.on('connect', () => {
            console.log('🔗 Conectado al WebSocket server:', socketRef.current.id);
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log('🔌 Desconectado del WebSocket');
            setIsConnected(false);
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('⚠️ Error WebSocket:', err.message);
            setIsConnected(false);
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    // Función para suscribirse a eventos dinámicamente
    const subscribe = (event, callback) => {
        if (socketRef.current) {
            socketRef.current.on(event, callback);
        }

        // Devolvemos el unsubscribe
        return () => {
            if (socketRef.current) {
                socketRef.current.off(event, callback);
            }
        };
    };

    return { socket: socketRef.current, isConnected, subscribe };
};

export default useSocket;
