'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/ui/card';
import { useAgentSocket } from '@/hooks/use-agent-socket';
import {
    Terminal as TerminalIcon,
    Play,
    MessageSquare,
    History,
    Bot,
    ChevronRight,
    Search,
    RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function AgentTerminal({ threadId: initialThreadId }: { threadId?: string }) {
    const [currentThreadId, setCurrentThreadId] = useState(initialThreadId || 'auto_default');
    const {
        status,
        history,
        streamingContent,
        threads,
        isLoadingHistory,
        startAgent,
        fetchHistory
    } = useAgentSocket(currentThreadId);

    const [chatInput, setChatInput] = useState('');
    const [viewMode, setViewMode] = useState<'live' | 'history'>('live');
    const [showSidebar, setShowSidebar] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom on new content
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, streamingContent]);

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim()) return;
        startAgent(chatInput);
        setChatInput('');
    };

    const handleSelectRun = (id: string) => {
        setCurrentThreadId(id);
        setViewMode('history');
        setShowSidebar(false);
    };

    // Filter for autonomous threads
    const autoThreads = useMemo(() => {
        return threads.filter(t => t.id.startsWith('auto_'));
    }, [threads]);

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 h-[500px] lg:h-[700px]">
            {/* Run History Sidebar - Collapsible on Mobile */}
            <Card className={cn(
                "col-span-12 lg:col-span-3 bg-zinc-950/50 border-zinc-800 rounded-2xl flex flex-col overflow-hidden transition-all duration-300",
                !showSidebar && "hidden lg:flex",
                showSidebar && "flex fixed inset-0 z-50 lg:relative lg:inset-auto"
            )}>
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Autonomous Runs</span>
                    <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-zinc-600" />
                        <button
                            onClick={() => setShowSidebar(false)}
                            className="lg:hidden p-1 hover:bg-zinc-800 rounded"
                        >
                            <ChevronRight className="w-4 h-4 text-zinc-400 rotate-180" />
                        </button>
                    </div>
                </div>
                <div className="p-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
                        <Input
                            placeholder="SEARCH RUNS..."
                            className="bg-zinc-900/50 border-zinc-800 pl-8 text-[10px] uppercase font-bold text-zinc-400 h-8"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    <div className="p-2 space-y-1">
                        {autoThreads.map(thread => (
                            <button
                                key={thread.id}
                                onClick={() => handleSelectRun(thread.id)}
                                className={cn(
                                    "w-full p-3 rounded-xl border transition-all text-left flex flex-col gap-1 group",
                                    currentThreadId === thread.id
                                        ? "bg-blue-600/10 border-blue-500/50"
                                        : "bg-transparent border-transparent hover:bg-zinc-900/50 hover:border-zinc-800"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-tight",
                                        currentThreadId === thread.id ? "text-blue-400" : "text-zinc-400"
                                    )}>
                                        {thread.id.slice(5, 15)}...
                                    </span>
                                    <span className="text-[8px] font-bold text-zinc-600">
                                        {new Date(thread.lastMessageAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="text-[9px] text-zinc-500 truncate font-mono">
                                    Last action completed
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Main Terminal Window */}
            <Card className="col-span-12 lg:col-span-9 bg-black border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative flex-1 min-h-0">
                {/* Header / Tabs */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 lg:px-6 py-2 lg:py-3 bg-zinc-900/80 border-b border-zinc-800 backdrop-blur-md gap-3 sm:gap-0">
                    <div className="flex items-center justify-between sm:justify-start gap-3 lg:gap-6">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowSidebar(true)}
                                className="lg:hidden p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400"
                            >
                                <History className="w-4 h-4" />
                            </button>
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-zinc-300">Swarm Protocol v1.4.2</span>
                        </div>
                        <div className="hidden sm:block h-4 w-[1px] bg-zinc-800" />
                        <div className="flex gap-3 lg:gap-4">
                            <button
                                onClick={() => setViewMode('live')}
                                className={cn(
                                    "text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-colors",
                                    viewMode === 'live' ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                [ Live ]
                            </button>
                            <button
                                onClick={() => setViewMode('history')}
                                className={cn(
                                    "text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-colors",
                                    viewMode === 'history' ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                [ Logs ]
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                        <Badge variant="outline" className="text-[8px] lg:text-[9px] font-mono border-zinc-800 bg-zinc-950 text-zinc-500 font-bold px-1.5">
                            ID: {currentThreadId.slice(0, 8).toUpperCase()}
                        </Badge>
                        <button className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-white">
                            <RefreshCw className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Terminal Content Area */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                    {/* View: Live/History Stream */}
                    <div className="flex-1 overflow-y-auto bg-[url('/terminal-bg.png')] bg-cover scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                        <div className="p-6 font-mono space-y-4">
                            {history.length === 0 && !streamingContent && (
                                <div className="h-[250px] lg:h-[400px] flex flex-col items-center justify-center opacity-30">
                                    <TerminalIcon className="w-12 h-12 text-zinc-600 mb-4" />
                                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Awaiting Kernel Initialization...</p>
                                </div>
                            )}

                            {history.map((msg, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "mt-1 w-1.5 h-4 rounded-full",
                                            msg.role === 'user' ? "bg-zinc-700" : "bg-blue-500"
                                        )} />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">
                                                    {msg.role === 'user' ? 'Operator' : 'Swarm.Brain'} @ {new Date(msg.createdAt || Date.now()).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className={cn(
                                                "text-xs leading-relaxed max-w-none",
                                                msg.role === 'user' ? "text-zinc-400 italic" : "text-zinc-200 prose prose-invert prose-sm markdown-content"
                                            )}>
                                                {msg.role === 'assistant' ? (
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content || ''}
                                                    </ReactMarkdown>
                                                ) : (
                                                    msg.content
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Tool Calls Decoration */}
                                    {msg.role === 'assistant' && msg.content.includes('tool_use') && (
                                        <div className="ml-5 p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/50 border-l-cyan-500/50 border-l-2">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">
                                                <Bot className="w-3 h-3" /> External Tool Invoked
                                            </div>
                                            <div className="text-[9px] text-zinc-500 italic">
                                                Processing discovery vectors... synchronized 14 records.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {streamingContent && (
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 w-1.5 h-4 rounded-full bg-cyan-500 animate-pulse" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter mr-2">
                                                Swarm.Brain [STREAMING]
                                            </span>
                                            <div className="flex gap-0.5">
                                                <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]" />
                                                <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]" />
                                                <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce" />
                                            </div>
                                        </div>
                                        <div className="text-xs text-cyan-50 text-shadow-glow leading-relaxed prose prose-invert prose-sm markdown-content max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {streamingContent}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* Chat Input Overlay / Toolbar */}
                    <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 backdrop-blur-xl">
                        <form onSubmit={handleSendMessage} className="relative flex items-center gap-3">
                            <div className="bg-zinc-950 border border-zinc-800 rounded-xl flex-1 flex items-center px-4 focus-within:border-blue-500/50 transition-all shadow-inner">
                                <span className="text-zinc-600 font-mono text-xs mr-2 pr-2 border-r border-zinc-800 select-none">SYSTEM.SH {'>'}</span>
                                <input
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-xs font-mono py-3 text-zinc-200"
                                    placeholder="Enter directive to modify current swarm logic..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
                                    >
                                        <Play className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                            >
                                <MessageSquare className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="bg-zinc-900 border-t border-zinc-800 px-6 py-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5">
                            <span className="text-zinc-700">ST:</span>
                            <span className={cn(
                                status === 'running' ? "text-green-500" : "text-zinc-400"
                            )}>{status === 'running' ? 'EXECUTING' : 'IDLE'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-zinc-700">CPU:</span>
                            <span className="text-zinc-400">12%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-zinc-700">MEM:</span>
                            <span className="text-zinc-400">242MB</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>LATENCY: 42MS</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                    </div>
                </div>
            </Card>
        </div>
    );
}
