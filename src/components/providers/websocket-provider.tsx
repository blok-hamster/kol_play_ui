'use client';

import React, { useEffect, ReactNode } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useUserStore } from '@/stores/use-user-store';

interface WebSocketProviderProps {
    children: ReactNode;
}

/**
 * Global provider to initialize and maintain the WebSocket connection
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
    const isAuthenticated = useUserStore(state => state.isAuthenticated);

    const isWsEnabled = process.env.NEXT_PUBLIC_WS_ENABLED === 'true';

    // Initialize WebSocket with auto-connect if enabled
    const { connect, disconnect, isConnected } = useWebSocket({
        autoConnect: isWsEnabled,
        subscriptions: {
            trades: true,
            notifications: true,
            priceUpdates: true,
            balanceUpdates: true,
        }
    });

    useEffect(() => {
        if (isAuthenticated && isWsEnabled) {
            connect().catch((err: any) => {
                const isConnectionError =
                    err.message === 'websocket error' ||
                    err.message === 'xhr poll error' ||
                    err.message?.includes('TransportError');

                if (!isConnectionError) {
                    console.error('🔌 WebSocket Provider: Failed to connect:', err);
                }
            });
        } else {
            disconnect();
        }
    }, [isAuthenticated, isWsEnabled, connect, disconnect]);

    // Debug log for connection status changes
    useEffect(() => {
        if (isConnected) {
            // Log removed
        }
    }, [isConnected]);

    return <>{children}</>;
};

export default WebSocketProvider;
