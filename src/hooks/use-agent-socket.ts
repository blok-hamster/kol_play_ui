'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserStore } from '@/stores/use-user-store';
import apiClient from '@/lib/api';

interface AgentMessage {
    id: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

interface BrowserAction {
    type: 'navigating' | 'loading' | 'parsing' | 'completed' | 'error';
    url: string;
    message: string;
}

interface BrowserFrame {
    url: string;
    data: string; // base64 jpeg
    metadata: any;
}

export const useAgentSocket = (threadId: string) => {
    const { user, isAuthenticated } = useUserStore();
    const socketRef = useRef<Socket | null>(null);
    const threadIdRef = useRef(threadId);
    const [isConnected, setIsConnected] = useState(false);
    const [history, setHistory] = useState<AgentMessage[]>([]);
    const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
    const [streamingContent, setStreamingContent] = useState('');
    const [browserAction, setBrowserAction] = useState<BrowserAction | null>(null);
    const [lastFrame, setLastFrame] = useState<BrowserFrame | null>(null);
    const [threads, setThreads] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = useCallback(() => {
        if (!socketRef.current || !isConnected) return;
        setIsLoadingHistory(true);
        socketRef.current.emit('agent:history', { threadId });
    }, [isConnected, threadId]);

    const fetchThreads = useCallback(() => {
        if (!socketRef.current || !isConnected) return;
        socketRef.current.emit('agent:threads');
    }, [isConnected]);

    // 1. Decoupled Socket Initialization (Auth only)
    useEffect(() => {
        const token = apiClient.getToken();
        if (!token || !isAuthenticated) return;

        const socketUrl = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';
        
        const socket = io(socketUrl, {
            auth: { token },
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            console.log('🔌 Connected to Agent Orchestrator');
            socket.emit('agent:threads');
            // History will be fetched by the Pivot effect below once isConnected=true
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('🔌 Disconnected from Agent Orchestrator');
        });

        socket.on('agent:status', (data) => {
            if (data.threadId === threadIdRef.current) {
                setStatus(data.status);
            }
        });

        socket.on('agent:token', (data) => {
            if (data.threadId === threadIdRef.current) {
                // 1. Handle simple delta token
                if (data.token) {
                    setStreamingContent(prev => prev + data.token);
                    return;
                }

                // 2. Handle LangGraph chunks
                if (data.chunk) {
                    const nodes = Object.keys(data.chunk);
                    if (nodes.length > 0) {
                        const nodeName = nodes[0];
                        if (nodeName === 'supervisor') return;

                        const nodeData = data.chunk[nodeName];
                        if (nodeData.messages && Array.isArray(nodeData.messages)) {
                            const lastMsg = nodeData.messages[nodeData.messages.length - 1];
                            const content = typeof lastMsg === 'string' ? lastMsg : (lastMsg.content || lastMsg.text || '');
                            if (content && typeof content === 'string') {
                                setStreamingContent(content);
                            }
                        }
                    }
                }
            }
        });

        socket.on('agent:history:response', (data) => {
            if (data.threadId === threadIdRef.current) {
                console.log(`[Socket] 📜 History Response for ${data.threadId} (${data.messages?.length || 0} msgs)`);
                
                const normalizedHistory: AgentMessage[] = (data.messages || []).map((m: any, index: number) => {
                    let role = m.role || '';
                    if (!role) {
                        const type = (m.type || m._getType?.() || m._type || '').toLowerCase();
                        if (type === 'human' || type === 'user') role = 'user';
                        else role = 'assistant';
                    }

                    let content = m.content || m.text || '';
                    if (Array.isArray(content)) {
                        content = content.map((c: any) => typeof c === 'string' ? c : (c.text || c.content || '')).join('');
                    }

                    return {
                        id: m.id || `msg_${index}`,
                        threadId: data.threadId,
                        role: role as 'user' | 'assistant' | 'system',
                        content: String(content || ''),
                        timestamp: m.timestamp || Date.now()
                    };
                }).filter((m: any) => m.role === 'user' || (m.content && m.content.trim().length > 0));

                setHistory(prev => {
                    // Logic: If we are running, the local history might have a NEWER optimistic message.
                    // We should merge them, keeping the confirmed ones from the backend and any new unique local ones.
                    const backendIds = new Set(normalizedHistory.map(m => m.id));
                    const optimisticOnes = prev.filter(m => !backendIds.has(m.id) && m.role === 'user');
                    
                    const final = [...normalizedHistory, ...optimisticOnes];
                    // Sort by timestamp just in case
                    return final.sort((a, b) => a.timestamp - b.timestamp);
                });

                setIsLoadingHistory(false);
                setStreamingContent(''); 
            }
        });

        socket.on('agent:history:empty', (data) => {
            if (data.threadId === threadIdRef.current) {
                console.log(`[Socket] 📭 Thread ${data.threadId} is empty.`);
                setHistory(prev => {
                    // If we have optimistic user messages, don't wipe them!
                    if (prev.some(m => m.role === 'user')) {
                        console.log(`[Socket] 🛡️ Preserving optimistic messages despite empty response.`);
                        return prev;
                    }
                    return [];
                });
                setIsLoadingHistory(false);
                setStreamingContent('');
            }
        });

        socket.on('agent:threads:response', (data) => {
            console.log('[useAgentSocket] 📥 Received agent:threads:response:', data);
            console.log('[useAgentSocket] 📋 Number of threads:', data.threads?.length);
            if (data.threads) {
                console.log('[useAgentSocket] 🔍 Sample thread IDs:', data.threads.slice(0, 3).map((t: any) => t.thread_id));
                setThreads(data.threads);
            }
        });

        socket.on('agent:complete', (data) => {
            if (data.threadId === threadIdRef.current) {
                console.log(`[Socket] ✅ Turn Complete for ${data.threadId}`);
                setStatus('completed');
                socket.emit('agent:history', { threadId: data.threadId });
                socket.emit('agent:threads');
            }
        });

        socket.on('agent:error', (data) => {
            if (data.threadId === threadIdRef.current) {
                setStatus('error');
                setError(data.error);
                setIsLoadingHistory(false);
            }
        });

        socket.on('agent:browser:action', (data) => setBrowserAction(data));
        socket.on('agent:browser:frame', (data) => setLastFrame(data));

        return () => {
            console.log(`[Socket] 🔌 Disconnecting socket`);
            socket.disconnect();
        };
    }, [isAuthenticated]);

    // 2. Immediate State Pivot on thread change
    useEffect(() => {
        console.log(`[Socket] 🚪 Pivot to Thread: ${threadId}. Wiping state.`);
        threadIdRef.current = threadId;
        
        // Instant Cleanup
        setHistory([]);
        setStreamingContent('');
        setStatus('idle');
        setError(null);
        setBrowserAction(null);
        setLastFrame(null);

        if (socketRef.current && isConnected) {
            setIsLoadingHistory(true);
            socketRef.current.emit('agent:history', { threadId });
            socketRef.current.emit('agent:threads');
        }
    }, [threadId, isConnected]);

    const startAgent = useCallback((input: string, agentType: string = 'standard_swarm') => {
        if (!socketRef.current || !isConnected) return;
        
        setError(null);
        setStreamingContent('');
        setStatus('running');
        setBrowserAction(null);
        setLastFrame(null);

        // Optimistic Update: Add user message to history immediately
        const msgId = `u_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        socketRef.current.emit('agent:start', {
            agentType,
            threadId,
            input: { 
                messages: [{ 
                    id: msgId,
                    role: 'user', 
                    content: input 
                }] 
            },
            userId: user?.id
        });

        const optimisticUserMsg: AgentMessage = {
            id: msgId,
            role: 'user',
            content: input,
            timestamp: Date.now(),
            threadId
        };
        setHistory(prev => [...prev.filter(m => m.id !== msgId), optimisticUserMsg]);
    }, [isConnected, threadId, user?.id]);

    const stopAgent = useCallback(() => {
        if (!socketRef.current) return;
        socketRef.current.emit('agent:stop', { threadId });
        setStatus('idle');
    }, [threadId]);

    return {
        isConnected,
        status,
        history,
        isLoadingHistory,
        streamingContent,
        browserAction,
        lastFrame,
        error,
        startAgent,
        stopAgent,
        fetchHistory,
        fetchThreads,
        threads
    };
};
