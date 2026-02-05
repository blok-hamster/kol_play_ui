'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { useAgentSocket } from '@/hooks/use-agent-socket';
import { ChatInterface } from '@/components/agent/ChatInterface';
import { BrowserFrame } from '@/components/agent/BrowserFrame';
import { AgentHistory } from '@/components/agent/AgentHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Globe as BrowserIcon,
  Layers,
  Cpu,
  ExternalLink,
  Zap,
  History,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function AgentPage() {
  const searchParams = useSearchParams();
  const queryThreadId = searchParams.get('threadId');

  const [currentThreadId, setCurrentThreadId] = useState<string>(() => {
    if (queryThreadId) return queryThreadId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kolplay_current_thread') || 'default-thread';
    }
    return 'default-thread';
  });

  // Update thread if query param changes
  useEffect(() => {
    if (queryThreadId && queryThreadId !== currentThreadId) {
      setCurrentThreadId(queryThreadId);
    }
  }, [queryThreadId, currentThreadId]);

  const {
    isConnected,
    status,
    history,
    isLoadingHistory,
    streamingContent,
    browserAction,
    lastFrame,
    error: socketError,
    startAgent,
    stopAgent,
    fetchHistory,
    threads
  } = useAgentSocket(currentThreadId);

  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(true);

  // Sync currentThreadId to localStorage
  useEffect(() => {
    localStorage.setItem('kolplay_current_thread', currentThreadId);
  }, [currentThreadId]);

  const handleNewChat = useCallback(() => {
    // Generate a unique thread ID
    const newId = `thread_${Math.random().toString(36).substring(2, 15)}`;
    setCurrentThreadId(newId);
  }, []);

  const handleSelectThread = useCallback((id: string) => {
    console.log(`[AgentPage] Switching to thread: ${id}`);
    setCurrentThreadId(id);
  }, []);

  // Combine persistent history with the live stream
  const displayMessages = useMemo(() => {
    return history;
  }, [history]);

  const handleSend = useCallback((content: string) => {
    startAgent(content);
  }, [startAgent]);

  return (
    <AppLayout>
      <div className="h-[calc(100vh-120px)] lg:h-[calc(100vh-160px)] bg-transparent overflow-hidden flex flex-col">
        <div className="mx-auto p-4 md:p-6 lg:p-4 w-full flex-1 min-h-0 flex flex-col">
          <div className="flex gap-4 md:gap-6 flex-1 min-h-0 relative overflow-hidden">

            {/* 1. History Sidebar (Collapsible) */}
            <aside className={cn(
              "hidden xl:flex flex-col shrink-0 transition-all duration-300 ease-in-out",
              showHistory ? "w-72 opacity-100 mr-2" : "w-0 opacity-0 pointer-events-none"
            )}>
              <div className="w-72 h-full overflow-hidden">
                <AgentHistory
                  threads={threads}
                  currentThreadId={currentThreadId}
                  onSelectThread={handleSelectThread}
                  onNewChat={handleNewChat}
                  className="h-full border-r-0 rounded-2xl shadow-none"
                />
              </div>
            </aside>

            {/* 2. Main Chat Area */}
            <main className="flex-1 flex flex-col min-w-0 relative h-full">

              {/* Desktop Toggle Button (Integrated into the edge of the chat area) */}
              <div className="hidden xl:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-30">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowHistory(!showHistory)}
                  className="bg-card border-border/50 hover:bg-primary/10 text-muted-foreground w-6 h-12 rounded-full shadow-lg border-2 hover:text-primary transition-all group"
                  title={showHistory ? "Collapse History" : "Expand History"}
                >
                  {showHistory ? (
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  ) : (
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  )}
                </Button>
              </div>

              {/* Mobile/Small Screen Header */}
              <div className="xl:hidden mb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">
                    SWARM {status.toUpperCase()}
                  </Badge>
                </div>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 rounded-lg bg-card/40 border border-border/50 text-muted-foreground"
                >
                  <History className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-h-0">
                <ChatInterface
                  messages={displayMessages}
                  streamingContent={streamingContent}
                  isStreaming={status === 'running' || isLoadingHistory}
                  isLoadingHistory={isLoadingHistory}
                  onSend={handleSend}
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  isConnected={isConnected}
                  isFocused={!showHistory}
                />
              </div>
            </main>

            {/* 3. Status & Browser Panel */}
            <aside className="hidden lg:flex flex-col w-[400px] xl:w-[450px] gap-6 shrink-0 h-full">
              {/* Execution Status Card */}
              <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-xl border-t-primary/20 border-t-2 shrink-0">
                <CardHeader className="py-3 px-5 flex flex-row items-center justify-between space-y-0 border-b border-border/10">
                  <CardTitle className="text-[10px] md:text-xs font-bold flex items-center gap-2 uppercase tracking-[0.2em] text-muted-foreground">
                    <Activity className="w-3 h-3 text-primary" />
                    Real-time Metrics
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {status === 'running' && (
                      <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
                    )}
                    <Badge variant="secondary" className="px-2 py-0 text-[10px] font-mono bg-background/50">
                      {status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-background/40 border border-border/30">
                      <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">Engine Node</p>
                      <div className="flex items-center gap-2 font-mono text-xs text-foreground">
                        <Cpu className="w-3 h-3 text-[#9945ff]" />
                        <span className="truncate">{status === 'running' ? 'SWARM_ORCH_V1' : 'STDBY'}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-background/40 border border-border/30">
                      <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">WebSocket</p>
                      <div className={cn(
                        "flex items-center gap-2 font-mono text-xs",
                        isConnected ? "text-[#14f195]" : "text-red-400"
                      )}>
                        <Zap className="w-3 h-3" />
                        {isConnected ? 'LIVE' : 'OFFLINE'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Browser Section */}
              <div className="flex-1 flex flex-col min-h-0 bg-card/40 backdrop-blur-md border border-border/50 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-border/30 bg-muted/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BrowserIcon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Browser Sandbox</span>
                  </div>
                </div>

                <div className="flex-1 relative bg-black/40">
                  <BrowserFrame
                    frame={lastFrame}
                    action={browserAction}
                    error={socketError}
                    className="h-full border-0 rounded-none bg-transparent"
                  />

                  {!browserAction && !lastFrame && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-muted/20 flex items-center justify-center border border-border/30 mb-4 rotate-3 group-hover:rotate-0 transition-transform">
                        <LayoutDashboard className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                      <h4 className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">Awaiting Task</h4>
                      <p className="text-[10px] text-muted-foreground/50 max-w-[200px] mt-2 leading-relaxed">
                        Browser remains dormant until a research or transaction verification request is initialized by the swarm.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tool Capabilities Feed */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  { icon: ExternalLink, label: 'Search Engine', color: '#14f195' },
                  { icon: Layers, label: 'Solana Swaps', color: '#9945ff' },
                  { icon: Zap, label: 'Flash Intelligence', color: '#3b82f6' }
                ].map((tool, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/10 border border-border/30 text-[10px] font-medium text-muted-foreground hover:bg-muted/20 transition-colors">
                    <tool.icon className="w-3 h-3" style={{ color: tool.color }} />
                    {tool.label}
                  </div>
                ))}
              </div>

            </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}