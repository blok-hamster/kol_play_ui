import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, MessageCircle, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AgentHistoryProps {
    threads: Array<{ id: string, preview: string, timestamp: number }>;
    currentThreadId: string;
    onSelectThread: (threadId: string) => void;
    onNewChat: () => void;
    className?: string;
}

export const AgentHistory: React.FC<AgentHistoryProps> = ({
    threads,
    currentThreadId,
    onSelectThread,
    onNewChat,
    className
}) => {
    return (
        <Card className={cn("bg-card/40 backdrop-blur-md border-border/50 h-full flex flex-col", className)}>
            <CardHeader className="py-4 px-6 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                    <Clock className="w-4 h-4 text-primary" />
                    Conversations
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNewChat}
                    className="h-8 w-8 hover:bg-primary/20 text-primary border border-primary/20"
                    title="New Chat"
                >
                    <Plus className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto scrollbar-none">
                {threads.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                        No previous chats found.
                    </div>
                ) : (
                    <div className="divide-y divide-border/30">
                        {threads.map((thread) => (
                            <button
                                key={thread.id}
                                onClick={() => {
                                    console.log(`[AgentHistory] Clicked thread: ${thread.id}`);
                                    onSelectThread(thread.id);
                                }}
                                className={cn(
                                    "w-full text-left p-4 hover:bg-primary/5 transition-colors group flex items-start gap-3",
                                    currentThreadId === thread.id && "bg-primary/10 border-r-2 border-r-primary"
                                )}
                            >
                                <MessageCircle className={cn(
                                    "w-4 h-4 mt-0.5 shrink-0",
                                    currentThreadId === thread.id ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                                )} />
                                <div className="flex-1 min-w-0">
                                    <div className={cn(
                                        "text-xs font-semibold truncate sidebar-markdown-preview",
                                        currentThreadId === thread.id ? "text-primary" : "text-foreground"
                                    )}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {thread.preview || "Untitled Chat"}
                                        </ReactMarkdown>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1 flex justify-between">
                                        <span>ID: {thread.id?.substring(0, 8) || '...'}</span>
                                        <span>{thread.timestamp ? new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </p>
                                </div>
                                <ChevronRight className="w-3 h-3 text-muted-foreground/30 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
