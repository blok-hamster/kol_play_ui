'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Search, ExternalLink, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { io, Socket } from 'socket.io-client';
import apiClient from '@/lib/api';
import { TokenMetadataService } from '@/services/token-metadata.service';

interface RecentAnalysisListProps {
    className?: string;
}

interface Thread {
    id: string;
    preview: string;
    timestamp: number;
}

interface TokenMetadata {
    name: string;
    symbol: string;
    image?: string;
}

export const RecentAnalysisList: React.FC<RecentAnalysisListProps> = ({ className }) => {
    const router = useRouter();
    const [threads, setThreads] = useState<Thread[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedThread, setSelectedThread] = useState<any>(null);
    const [summaryModalOpen, setSummaryModalOpen] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [tokenMetadata, setTokenMetadata] = useState<Record<string, TokenMetadata>>({});

    // Initialize socket connection
    useEffect(() => {
        const token = apiClient.getToken();
        if (!token) {
            console.warn('[RecentAnalysisList] No auth token available');
            return;
        }

        const socketUrl = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';
        console.log('[RecentAnalysisList] 🔌 Connecting to:', socketUrl);

        const newSocket = io(socketUrl, {
            auth: { token },
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('[RecentAnalysisList] ✅ Connected to agent socket');
            setIsConnected(true);
            // Fetch threads immediately on connect
            newSocket.emit('agent:threads');
        });

        newSocket.on('disconnect', () => {
            console.log('[RecentAnalysisList] ❌ Disconnected from agent socket');
            setIsConnected(false);
        });

        newSocket.on('agent:threads:response', (data) => {
            console.log('[RecentAnalysisList] 📥 Received threads response:', data);
            if (data.threads) {
                console.log('[RecentAnalysisList] 📋 Total threads received:', data.threads.length);
                console.log('[RecentAnalysisList] 🔍 First thread full object:', data.threads[0]);
                console.log('[RecentAnalysisList] 🔍 Thread object keys:', data.threads[0] ? Object.keys(data.threads[0]) : 'NO THREADS');
                console.log('[RecentAnalysisList] 🔍 Sample thread IDs:', data.threads.slice(0, 5).map((t: any) => t.thread_id));
                setThreads(data.threads);

                // Fetch metadata for sentiment threads
                const sentimentThreads = data.threads.filter((t: Thread) =>
                    t && typeof t.id === 'string' && t.id.startsWith('sentiment-')
                );
                fetchMetadataForThreads(sentimentThreads);
            }
        });

        setSocket(newSocket);

        return () => {
            console.log('[RecentAnalysisList] 🔌 Disconnecting socket');
            newSocket.disconnect();
        };
    }, []);

    // Poll for thread updates
    useEffect(() => {
        if (!socket || !isConnected) return;

        console.log('[RecentAnalysisList] 🔄 Setting up polling...');
        const interval = setInterval(() => {
            socket.emit('agent:threads');
        }, 10000);

        return () => clearInterval(interval);
    }, [socket, isConnected]);

    // Fetch token metadata for threads
    const fetchMetadataForThreads = async (threads: Thread[]) => {
        const newMetadata: Record<string, TokenMetadata> = {};

        for (const thread of threads) {
            const mintAddress = extractMintFromThreadId(thread.id);
            if (mintAddress && !tokenMetadata[mintAddress]) {
                try {
                    const metadata = await TokenMetadataService.getTokenMetadata(mintAddress);
                    if (metadata) {
                        newMetadata[mintAddress] = {
                            name: metadata.name || 'Unknown Token',
                            symbol: metadata.symbol || 'UNK',
                            image: metadata.image
                        };
                    }
                } catch (error) {
                    console.error(`[RecentAnalysisList] Failed to fetch metadata for ${mintAddress}:`, error);
                }
            }
        }

        if (Object.keys(newMetadata).length > 0) {
            setTokenMetadata(prev => ({ ...prev, ...newMetadata }));
        }
    };

    // Extract mint address from thread ID (format: sentiment-MINT-TIMESTAMP)
    const extractMintFromThreadId = (threadId: string): string | null => {
        const parts = threadId.split('-');
        if (parts.length >= 3 && parts[0] === 'sentiment') {
            // Join all parts except first (sentiment) and last (timestamp)
            return parts.slice(1, -1).join('-');
        }
        return null;
    };

    const handleOpenAnalysis = (thread: any) => {
        setSelectedThread(thread);
        setSummaryModalOpen(true);
    };

    const navigateToAssistant = (threadId: string) => {
        router.push(`/agent?threadId=${threadId}`);
    };

    // Extract token label from thread ID (format: sentiment-TOKEN-TIMESTAMP)
    const getTokenLabel = (threadId: string) => {
        const parts = threadId.split('-');
        if (parts.length >= 2) return parts[1];
        return 'Unknown Token';
    };

    // Filter threads for sentiment analysis threads
    const sentimentThreads = threads
        .filter(t => t && typeof t.id === 'string' && t.id.startsWith('sentiment-'))
        .filter(t => t.id.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

    console.log('[RecentAnalysisList] 📊 Filtered sentiment threads:', sentimentThreads.length);
    if (sentimentThreads.length > 0) {
        console.log('[RecentAnalysisList] ✅ Sample sentiment thread IDs:', sentimentThreads.slice(0, 3).map(t => t.id));
    }

    return (
        <div className={cn("flex flex-col h-full bg-card/30 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-2xl relative", className)}>
            {/* Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                            <Clock className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-foreground uppercase tracking-widest">Recent Analysis</h3>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Swarm Intelligence History</p>
                        </div>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search threads..."
                        className="pl-9 h-9 bg-black/40 border-white/5 text-xs font-mono"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {sentimentThreads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 opacity-40">
                        <Bot className="w-8 h-8 mb-2" />
                        <p className="text-xs uppercase tracking-tighter">No analysis found</p>
                    </div>
                ) : (
                    sentimentThreads.map((thread) => {
                        const mintAddress = extractMintFromThreadId(thread.id);
                        const metadata = mintAddress ? tokenMetadata[mintAddress] : null;
                        const displayName = metadata?.name || getTokenLabel(thread.id);
                        const displaySymbol = metadata?.symbol || getTokenLabel(thread.id);

                        return (
                            <motion.div
                                key={thread.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                onClick={() => handleOpenAnalysis(thread)}
                                className="group relative p-3 rounded-xl border border-border/50 bg-card/40 hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center group-hover:border-primary/20 transition-colors overflow-hidden">
                                            {metadata?.image ? (
                                                <img
                                                    src={metadata.image}
                                                    alt={displaySymbol}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        // Fallback to text if image fails to load
                                                        e.currentTarget.style.display = 'none';
                                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                    }}
                                                />
                                            ) : null}
                                            <span className={cn(
                                                "text-xs font-bold text-primary",
                                                metadata?.image && "hidden"
                                            )}>
                                                {displaySymbol.substring(0, 3).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-semibold text-foreground tracking-tight">
                                                    {displayName}
                                                </h4>
                                                {metadata?.symbol && (
                                                    <span className="text-xs text-muted-foreground font-mono">
                                                        ${metadata.symbol}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                <small>{formatDistanceToNow(new Date(thread.timestamp || Date.now()), { addSuffix: true })}</small>
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border bg-card/60">
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider opacity-60 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-primary" /> Sentinel v2.4
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/40">{sentimentThreads.length} Saved Scans</span>
                </div>
            </div>

            {/* Summary Modal */}
            <Modal
                isOpen={summaryModalOpen}
                onClose={() => setSummaryModalOpen(false)}
                title={(() => {
                    if (!selectedThread) return 'Analysis Summary';
                    const mintAddress = extractMintFromThreadId(selectedThread.id);
                    const metadata = mintAddress ? tokenMetadata[mintAddress] : null;
                    return metadata ? `${metadata.name} (${metadata.symbol})` : `Analysis Summary: ${getTokenLabel(selectedThread.id)}`;
                })()}
                size="md"
            >
                <div className="space-y-6">
                    {/* Token Header */}
                    {selectedThread && (() => {
                        const mintAddress = extractMintFromThreadId(selectedThread.id);
                        const metadata = mintAddress ? tokenMetadata[mintAddress] : null;

                        if (metadata) {
                            return (
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center overflow-hidden">
                                        {metadata.image ? (
                                            <img
                                                src={metadata.image}
                                                alt={metadata.symbol}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-lg font-bold text-primary">
                                                {metadata.symbol.substring(0, 3).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-foreground">{metadata.name}</h3>
                                        <p className="text-sm text-muted-foreground font-mono">${metadata.symbol}</p>
                                        {mintAddress && (
                                            <p className="text-xs text-muted-foreground/60 font-mono mt-1 truncate">
                                                {mintAddress}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <h5 className="text-[10px] uppercase font-bold text-primary tracking-widest mb-2 flex items-center gap-2">
                            <Bot className="w-3 h-3" /> Narrative Architect Findings
                        </h5>
                        <p className="text-sm leading-relaxed text-foreground/80 italic">
                            Select "Open in Assistant" to view the full dialogue, including deep sentiment metrics, bot detection results, and MindMap network patterns.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={() => navigateToAssistant(selectedThread?.id)}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 flex items-center gap-2 shadow-lg shadow-primary/20"
                        >
                            Open in Assistant <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setSummaryModalOpen(false)}
                            className="w-full h-12 font-bold"
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
