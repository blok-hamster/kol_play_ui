import React, { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, User, Send, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

interface ChatInterfaceProps {
    messages: Message[];
    streamingContent: string;
    isStreaming: boolean;
    onSend: (content: string) => void;
    inputValue: string;
    setInputValue: (value: string) => void;
    isConnected: boolean;
    isFocused?: boolean;
    isLoadingHistory?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    messages,
    streamingContent,
    isStreaming,
    onSend,
    inputValue,
    setInputValue,
    isConnected,
    isFocused = false,
    isLoadingHistory = false
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messages.length > 0) {
            console.log('[ChatInterface] Messages updated:', messages);
        }
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streamingContent]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (inputValue.trim() && isConnected && !isStreaming) {
                onSend(inputValue.trim());
                setInputValue('');
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-background/40 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                            <Bot className="w-6 h-6 text-primary" />
                        </div>
                        <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                            isConnected ? "bg-green-500" : "bg-red-500"
                        )} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">AI Orchestrator</h3>
                            {isFocused && (
                                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary uppercase text-[8px] px-1.5 py-0 tracking-widest font-bold h-4">
                                    Focused
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {isConnected ? 'Swarms Active' : 'Connecting to Swarms...'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent"
            >
                {messages.map((m) => (
                    <div key={m.id} className={cn(
                        "flex gap-3 md:gap-4 max-w-[90%] md:max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                        m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm",
                            m.role === 'user'
                                ? "bg-gradient-to-br from-[#9945ff] to-[#14f195] border-white/10"
                                : "bg-muted/80 border-border/50"
                        )}>
                            {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-primary" />}
                        </div>
                        <div className={cn(
                            "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm backdrop-blur-sm",
                            m.role === 'user'
                                ? "bg-gradient-to-br from-[#9945ff] to-[#7c3aed] text-white rounded-tr-none border border-white/10"
                                : "bg-card/50 border border-border/50 text-foreground rounded-tl-none"
                        )}>
                            <div className="whitespace-pre-wrap selection:bg-primary/30">
                                {String(m.content || '(Empty Message)')}
                            </div>
                            <div className={cn(
                                "mt-1.5 text-[10px] opacity-40 font-mono",
                                m.role === 'user' ? "text-right" : "text-left"
                            )}>
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Streaming Chunk / Phantom Message */}
                {streamingContent && (
                    <div className="flex gap-3 md:gap-4 max-w-[90%] md:max-w-[85%] mr-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-8 h-8 rounded-full bg-muted/80 border border-border/50 flex items-center justify-center shrink-0">
                            <Bot className={cn("w-4 h-4 text-primary", isStreaming && "animate-pulse")} />
                        </div>
                        <div className="px-4 py-3 rounded-2xl rounded-tl-none text-sm leading-relaxed bg-card/50 border border-border/50 text-foreground shadow-sm backdrop-blur-sm">
                            <div className="whitespace-pre-wrap">{streamingContent}</div>
                            {isStreaming && (
                                <div className="mt-2 flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isStreaming && !streamingContent && (
                    <div className="flex gap-4 items-center text-sm text-muted-foreground animate-pulse ml-11 md:ml-12">
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                        <span className="font-medium tracking-tight">
                            {isLoadingHistory ? 'Retrieving conversation history...' : 'Swarm is strategizing...'}
                        </span>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-black/20 border-t border-border/30 backdrop-blur-md">
                <div className="relative group max-w-4xl mx-auto">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!isConnected || isStreaming}
                        placeholder={isConnected ? "Query your trading swarm..." : "Reconnecting to swarm..."}
                        className="pr-12 md:pr-14 py-6 md:py-7 bg-neutral-900/60 border-border/50 text-white placeholder:text-muted-foreground/60 transition-all rounded-2xl shadow-inner focus-visible:ring-primary/20 text-sm md:text-base"
                    />
                    <Button
                        size="icon"
                        disabled={!inputValue.trim() || !isConnected || isStreaming}
                        onClick={() => {
                            onSend(inputValue.trim());
                            setInputValue('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-9 w-9 md:h-11 md:w-11 rounded-xl bg-gradient-to-br from-[#9945ff] to-[#14f195] hover:opacity-90 transition-all shadow-lg text-white"
                    >
                        <Send className="w-4 h-4 md:w-5 md:h-5" />
                    </Button>
                </div>
                <p className="mt-3 text-[10px] text-white/40 text-center uppercase tracking-[0.1em] font-medium">
                    Advanced Web Analysis • Real-time Swarms • Vault Secure
                </p>
            </div>
        </div>
    );
};
