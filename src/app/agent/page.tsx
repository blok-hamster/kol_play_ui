'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';
import { useNotifications } from '@/stores/use-ui-store';
import { useUserStore } from '@/stores/use-user-store';
import { executeInstantBuy, executeInstantSell } from '@/lib/trade-utils';
import { SolanaService } from '@/services/solana.service';
import TokenSearch from '@/components/tokens/token-search';
import PredictTradeInput from '@/components/features/predict-trade-input';
import { Modal } from '@/components/ui/modal';
import {
  Bot,
  Send,
  History,
  Wallet,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Info,
  ExternalLink,
  RefreshCw,
  Search,
  Menu as MenuIcon,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}

export default function AgentChatPage() {
  const { isAuthenticated, user } = useUserStore();
  const { showError, showSuccess } = useNotifications();

  const [conversations, setConversations] = useState<Conversation[]>(() => [
    {
      id: 'conv-1',
      title: 'New Chat',
      createdAt: Date.now(),
      messages: [
        {
          id: 'm-welcome',
          role: 'assistant',
          content:
            'Hi! I can help you trade on Solana: buy/sell instantly, check balances, transfer SOL/SPL tokens, fetch token details, and run token predictions. What would you like to do?',
          timestamp: Date.now(),
        },
      ],
    },
  ]);
  const [activeConversationId, setActiveConversationId] = useState<string>('conv-1');
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // Quick action modal states
  const [openTradeModal, setOpenTradeModal] = useState(false);
  const [openPredictModal, setOpenPredictModal] = useState(false);
  const [openTokenDetailsModal, setOpenTokenDetailsModal] = useState(false);
  const [openTransferModal, setOpenTransferModal] = useState(false);
  const [openAgentMenu, setOpenAgentMenu] = useState(false);
  const [openHistoryModal, setOpenHistoryModal] = useState(false);

  // Trade modal local state
  const [selectedTradeToken, setSelectedTradeToken] = useState<{ mint: string; symbol?: string; name?: string } | null>(null);
  const [transferForm, setTransferForm] = useState<{ to: string; amount: string; mint?: string }>({ to: '', amount: '', mint: '' });

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId)!,
    [conversations, activeConversationId]
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const addMessage = (role: ChatMessage['role'], content: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              messages: [
                ...c.messages,
                { id: Math.random().toString(36).slice(2), role, content, timestamp: Date.now() },
              ],
            }
          : c
      )
    );
    setTimeout(scrollToBottom, 0);
  };

  const startNewConversation = () => {
    const id = 'conv-' + Math.random().toString(36).slice(2);
    const now = Date.now();
    setConversations((prev) => [
      {
        id,
        title: 'New Chat',
        createdAt: now,
        messages: [
          {
            id: 'm-welcome-' + id,
            role: 'assistant',
            content:
              'New session started. Ask me to buy/sell a token, get balances, transfer assets, or analyze a token.',
            timestamp: now,
          },
        ],
      },
      ...prev,
    ]);
    setActiveConversationId(id);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    addMessage('user', input.trim());
    setInput('');

    // Placeholder assistant response
    setIsThinking(true);
    try {
      // In the future, route to the AI agent backend
      addMessage(
        'assistant',
        'Got it. I will soon be able to execute actions based on your message. For now, use the quick actions below.'
      );
    } finally {
      setIsThinking(false);
    }
  };

  // Quick action handlers
  const handleInstantBuy = async (mint: string, symbol?: string) => {
    try {
      addMessage('user', `Instant buy ${symbol || mint}`);
      setIsThinking(true);
      const result = await executeInstantBuy(mint, symbol);
      if (result.success) {
        addMessage(
          'assistant',
          `Buy executed. TX: ${result.result?.transactionId || 'N/A'}`
        );
        showSuccess('Buy Order Executed', 'Your instant buy has been submitted.');
      } else {
        addMessage('assistant', `Buy failed: ${result.error || 'Unknown error'}`);
        showError('Buy Order Failed', result.error || 'Failed to execute buy');
      }
    } catch (e: any) {
      addMessage('assistant', `Buy error: ${e?.message || 'Unknown error'}`);
      showError('Buy Error', e?.message || 'Unknown error');
    } finally {
      setIsThinking(false);
    }
  };

  const handleInstantSell = async (mint: string, symbol?: string) => {
    try {
      addMessage('user', `Instant sell ${symbol || mint}`);
      setIsThinking(true);
      const result = await executeInstantSell(mint, symbol);
      if (result.success) {
        addMessage(
          'assistant',
          `Sell executed. TX: ${result.result?.transactionId || 'N/A'}`
        );
        showSuccess('Sell Order Executed', 'Your instant sell has been submitted.');
      } else {
        addMessage('assistant', `Sell failed: ${result.error || 'Unknown error'}`);
        showError('Sell Order Failed', result.error || 'Failed to execute sell');
      }
    } catch (e: any) {
      addMessage('assistant', `Sell error: ${e?.message || 'Unknown error'}`);
      showError('Sell Error', e?.message || 'Unknown error');
    } finally {
      setIsThinking(false);
    }
  };

  const handleGetBalances = async (address?: string) => {
    const target = address || user?.accountDetails?.address;
    if (!target) {
      showError('No Address', 'Please sign in or provide an address.');
      return;
    }
    try {
      addMessage('user', `Get balances for ${target}`);
      setIsThinking(true);
      const [sol, tokens] = await Promise.all([
        SolanaService.getSolBalance(target),
        SolanaService.getTokens(target, true),
      ]);
      const top = tokens.slice(0, 5);
      const tokenSummary = top
        .map((t) => `${t.symbol || t.mintAddress}: ${formatNumber(t.uiAmount || 0, 4)}`)
        .join(', ');
      addMessage(
        'assistant',
        `SOL: ${formatNumber(sol, 4)}. SPL tokens (${tokens.length}): ${tokenSummary}$${tokens.length > 5 ? '…' : ''}`
      );
      showSuccess('Balances Retrieved', 'Fetched SOL and SPL balances.');
    } catch (e: any) {
      addMessage('assistant', `Balance error: ${e?.message || 'Unknown error'}`);
      showError('Balance Error', e?.message || 'Unknown error');
    } finally {
      setIsThinking(false);
    }
  };

  const handleGetTokenDetails = async (mint: string) => {
    try {
      addMessage('user', `Get details for ${mint}`);
      setIsThinking(true);
      const { TokenService } = await import('@/services/token.service');
      const res = await TokenService.getToken(mint);
      const token = res.data?.token;
      if (!token) throw new Error('No token data');
      addMessage(
        'assistant',
        `${token.symbol || 'UNKNOWN'} — ${token.name || 'Unknown Name'}${token.price ? `, $${formatNumber(token.price, 6)}` : ''}`
      );
      showSuccess('Token Details', token.symbol || 'Token');
    } catch (e: any) {
      addMessage('assistant', `Details error: ${e?.message || 'Unknown error'}`);
      showError('Details Error', e?.message || 'Unknown error');
    } finally {
      setIsThinking(false);
    }
  };

  const handleTransfer = async (_params?: { to: string; amount: number; mint?: string }) => {
    // Placeholder: wire to wallet-signer flow later
    showError('Transfer Unavailable', 'Transfer actions will be enabled once the agent wallet is connected.');
  };

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="min-h-screen text-foreground">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center py-16">
              <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">AI Agent</h1>
              <p className="text-muted-foreground mb-6">
                Please sign in to use the AI agent for trading and wallet actions.
              </p>
              <Link href="/auth/signin">
                <Button>Sign In to Continue</Button>
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen text-foreground">
        {/* Mobile: fixed chat panel */}
        <div className="lg:hidden fixed inset-x-0 top-14 bottom-0 px-4 py-3 overflow-hidden">
          <Card className="h-full flex flex-col border border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg sm:text-xl">AI Agent</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleGetBalances()}>
                  <Wallet className="h-4 w-4 mr-2" />
                  Balances
                </Button>
                <Button size="sm" variant="outline" onClick={startNewConversation}>
                  <History className="h-4 w-4 mr-2" />
                  New Chat
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col min-h-0">
              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 space-y-3">
                {activeConversation.messages.map((m) => (
                  <div key={m.id} className={cn('flex w-full', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] min-w-0 rounded-xl border px-3 py-2 text-sm break-words',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/30 text-foreground border-border'
                      )}
                    >
                      <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
                      <div className={cn('mt-1 text-[10px]', m.role === 'user' ? 'text-white/80' : 'text-muted-foreground')}>
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Thinking…
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="mt-4 flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Ask the agent to buy/sell, check balances, transfer, or analyze a token…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                </div>
                <Button onClick={handleSend} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Mobile floating actions (moved up to avoid overlapping Send) */}
          <div className="lg:hidden fixed bottom-20 right-4 z-40">
            <Button className="shadow-lg" variant="secondary" onClick={() => setOpenAgentMenu(true)}>
              <MenuIcon className="h-4 w-4 mr-2" /> Menu
            </Button>
          </div>
        </div>

        {/* Desktop/large screens layout */}
        <div className="hidden lg:block">
          <div className="container mx-auto px-4 py-6 sm:py-8">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Conversation Area */}
              <div className="xl:col-span-2 space-y-4">
                <Card className="border border-border h-[70vh] flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg sm:text-xl">AI Agent</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleGetBalances()}>
                        <Wallet className="h-4 w-4 mr-2" />
                        Balances
                      </Button>
                      <Button size="sm" variant="outline" onClick={startNewConversation}>
                        <History className="h-4 w-4 mr-2" />
                        New Chat
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 flex-1 flex flex-col min-h-0">
                    {/* Messages */}
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 space-y-3">
                      {activeConversation.messages.map((m) => (
                        <div key={m.id} className={cn('flex w-full', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                          <div
                            className={cn(
                              'max-w-[85%] min-w-0 rounded-xl border px-3 py-2 text-sm break-words',
                              m.role === 'user'
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted/30 text-foreground border-border'
                            )}
                          >
                            <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
                            <div className={cn('mt-1 text-[10px]', m.role === 'user' ? 'text-white/80' : 'text-muted-foreground')}>
                              {new Date(m.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      {isThinking && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Thinking…
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Composer */}
                    <div className="mt-4 flex items-end gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Ask the agent to buy/sell, check balances, transfer, or analyze a token…"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                        />
                      </div>
                      <Button onClick={handleSend} disabled={!input.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Button variant="secondary" className="w-full" onClick={() => setOpenTradeModal(true)}>
                      <TrendingUp className="h-4 w-4 mr-2" /> Trade
                    </Button>
                    <Button variant="secondary" className="w-full" onClick={() => setOpenPredictModal(true)}>
                      <Info className="h-4 w-4 mr-2" /> Analyze & Predict
                    </Button>
                    <Button variant="secondary" className="w-full" onClick={() => setOpenTokenDetailsModal(true)}>
                      <Search className="h-4 w-4 mr-2" /> Token Details
                    </Button>
                    <Button variant="secondary" className="w-full" onClick={() => setOpenTransferModal(true)}>
                      <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* History Sidebar */}
              <div className="xl:col-span-1 space-y-4">
                <Card className="border border-border">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">Conversation History</CardTitle>
                    </div>
                    <Button size="sm" variant="outline" onClick={startNewConversation}>
                      New Chat
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="space-y-2">
                      {conversations.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setActiveConversationId(c.id)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                            c.id === activeConversationId
                              ? 'bg-muted/50 border-muted-foreground'
                              : 'bg-background border-border hover:bg-muted/30'
                          )}
                        >
                          <div className="text-sm font-semibold text-foreground truncate">{c.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">What can I do?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> Instant Buy</div>
                    <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /> Instant Sell</div>
                    <div className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Get SOL & SPL balances</div>
                    <div className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Transfer SOL & SPL</div>
                    <div className="flex items-center gap-2"><Info className="h-4 w-4" /> Token details & prediction</div>
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      More actions coming soon
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Modals shared for both mobile & desktop */}
        {/* Trade Modal */}
        <Modal
          isOpen={openTradeModal}
          onClose={() => {
            setOpenTradeModal(false);
            setSelectedTradeToken(null);
          }}
          title="Trade"
          description="Search a token and execute instant buy or sell"
          size="lg"
        >
          <div className="space-y-4">
            <TokenSearch
              placeholder="Search token to trade"
              showResults
              enableInstantBuy={false}
              onTokenSelect={(token: any) => {
                setSelectedTradeToken({ mint: token.mint, symbol: token.symbol, name: token.name });
              }}
            />
            {selectedTradeToken && (
              <div className="flex items-center justify-between border border-border rounded-lg p-3">
                <div className="text-sm text-foreground">
                  Selected: <span className="font-semibold">{selectedTradeToken.symbol || selectedTradeToken.name || selectedTradeToken.mint}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleInstantBuy(selectedTradeToken.mint, selectedTradeToken.symbol || selectedTradeToken.name)}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" /> Instant Buy
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleInstantSell(selectedTradeToken.mint, selectedTradeToken.symbol || selectedTradeToken.name)}
                  >
                    <TrendingDown className="h-4 w-4 mr-2" /> Instant Sell
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* Analyze & Predict Modal */}
        <Modal
          isOpen={openPredictModal}
          onClose={() => setOpenPredictModal(false)}
          title="Analyze & Predict"
          description="Paste one or more token mints to get model predictions"
          size="lg"
        >
          <PredictTradeInput />
        </Modal>

        {/* Token Details Modal */}
        <Modal
          isOpen={openTokenDetailsModal}
          onClose={() => setOpenTokenDetailsModal(false)}
          title="Token Details"
          description="Search a token to view details in chat"
          size="lg"
        >
          <div className="space-y-3">
            <TokenSearch
              placeholder="Search token for details"
              showResults
              onTokenSelect={(token: any) => {
                handleGetTokenDetails(token.mint);
                setOpenTokenDetailsModal(false);
              }}
            />
            <div className="text-xs text-muted-foreground">
              The agent will post token details into the conversation.
            </div>
          </div>
        </Modal>

        {/* Transfer Modal */}
        <Modal
          isOpen={openTransferModal}
          onClose={() => setOpenTransferModal(false)}
          title="Transfer"
          description="Send SOL or SPL tokens"
          size="md"
        >
          <div className="space-y-3">
            <Input
              placeholder="Recipient address"
              value={transferForm.to}
              onChange={(e) => setTransferForm((f) => ({ ...f, to: e.target.value }))}
            />
            <Input
              placeholder="Amount"
              type="number"
              min={0}
              step={0.000001}
              value={transferForm.amount}
              onChange={(e) => setTransferForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <Input
              placeholder="Token mint (leave empty for SOL)"
              value={transferForm.mint}
              onChange={(e) => setTransferForm((f) => ({ ...f, mint: e.target.value }))}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => handleTransfer({ to: transferForm.to, amount: parseFloat(transferForm.amount || '0') })}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer SOL
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTransfer({ to: transferForm.to, amount: parseFloat(transferForm.amount || '0'), mint: transferForm.mint || undefined })}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer SPL
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Transfers will be enabled when an agent wallet is connected.
            </div>
          </div>
        </Modal>

        {/* Agent Menu (mobile) */}
        <Modal
          isOpen={openAgentMenu}
          onClose={() => setOpenAgentMenu(false)}
          title="Agent Menu"
          description="Quick access to actions and history"
          size="md"
        >
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => { setOpenAgentMenu(false); setOpenTradeModal(true); }}>
              <TrendingUp className="h-4 w-4 mr-2" /> Trade
            </Button>
            <Button variant="secondary" onClick={() => { setOpenAgentMenu(false); setOpenPredictModal(true); }}>
              <Info className="h-4 w-4 mr-2" /> Predict
            </Button>
            <Button variant="secondary" onClick={() => { setOpenAgentMenu(false); setOpenTokenDetailsModal(true); }}>
              <Search className="h-4 w-4 mr-2" /> Details
            </Button>
            <Button variant="secondary" onClick={() => { setOpenAgentMenu(false); setOpenTransferModal(true); }}>
              <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer
            </Button>
            <Button variant="outline" onClick={() => { setOpenAgentMenu(false); handleGetBalances(); }}>
              <Wallet className="h-4 w-4 mr-2" /> Balances
            </Button>
            <Button variant="outline" onClick={() => { setOpenAgentMenu(false); setOpenHistoryModal(true); }}>
              <History className="h-4 w-4 mr-2" /> History
            </Button>
          </div>
        </Modal>

        {/* History Modal (mobile) */}
        <Modal
          isOpen={openHistoryModal}
          onClose={() => setOpenHistoryModal(false)}
          title="Conversation History"
          description="Switch between your chats"
          size="md"
        >
          <div className="space-y-2">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveConversationId(c.id); setOpenHistoryModal(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                  c.id === activeConversationId
                    ? 'bg-muted/50 border-muted-foreground'
                    : 'bg-background border-border hover:bg-muted/30'
                )}
              >
                <div className="text-sm font-semibold text-foreground truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString()}
                </div>
              </button>
            ))}
            <div className="pt-2">
              <Button variant="outline" onClick={() => { startNewConversation(); setOpenHistoryModal(false); }}>
                New Chat
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
} 