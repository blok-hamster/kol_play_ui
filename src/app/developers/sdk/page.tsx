'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Terminal, Copy, Check, Download, Box, Zap } from 'lucide-react';
import { useState } from 'react';

export default function SdkUsagePage() {
    const [copied, setCopied] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const installCmd = 'npm install @kolplayorg/sdk';
    const usageCode = `import { KolplayClient } from '@kolplayorg/sdk';

const client = new KolplayClient('YOUR_API_KEY');

// OR initialize with JWT for AI Agents/Frontends
const agentClient = new KolplayClient({ jwt: 'YOUR_JWT_TOKEN' });

// Fetch token metrics
const metrics = await client.getTokenMetrics('So111...');
console.log('Price:', metrics.price);

// Execute a simulation trade
const trade = await client.executeSwap({
  mint: 'So111...',
  amount: 0.1,
  tradeType: 'buy',
  isSimulation: true
});`;

    return (
        <div className="space-y-12 pb-24">
            {/* Hero Section */}
            <section>
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent italic">
                    KOLPLAY SDK
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                    Start building in minutes with our official TypeScript SDK. Isomorphic, type-safe, and optimized for speed.
                </p>
            </section>

            {/* Quick Start */}
            <section id="installation">
                <div className="flex items-center space-x-2 mb-6">
                    <Download className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">Installation</h2>
                </div>
                <Card className="bg-black/40 border-primary/20 group relative">
                    <CardContent className="p-6 flex items-center justify-between">
                        <code className="text-primary font-mono text-sm">{installCmd}</code>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(installCmd, 'install')}
                            className="text-muted-foreground hover:text-primary transition-colors"
                        >
                            {copied === 'install' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </CardContent>
                </Card>
            </section>

            {/* Features Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { icon: Box, title: 'Type Safe', desc: 'Full TypeScript support for all request/response objects.' },
                    { icon: Zap, title: 'Fast', desc: 'Optimized Axios client with automatic retries and timeouts.' },
                    { icon: Terminal, title: 'Isomorphic', desc: 'Works seamlessly in Node.js and Browser environments.' },
                ].map((f, i) => (
                    <Card key={i} className="bg-[#141414] border-white/5 hover:border-primary/20 transition-all duration-300">
                        <CardContent className="p-6">
                            <f.icon className="h-8 w-8 text-primary mb-4" />
                            <h3 className="text-md font-bold text-white mb-2">{f.title}</h3>
                            <p className="text-xs text-muted-foreground">{f.desc}</p>
                        </CardContent>
                    </Card>
                ))}
            </section>

            {/* Usage Example */}
            <section id="usage">
                <div className="flex items-center space-x-2 mb-6">
                    <Terminal className="h-6 w-6 text-secondary" />
                    <h2 className="text-2xl font-bold">Universal Usage</h2>
                </div>
                <div className="relative group">
                    <div className="absolute top-4 right-4 z-10">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(usageCode, 'usage')}
                            className="text-muted-foreground hover:text-white"
                        >
                            {copied === 'usage' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                    <pre className="p-6 bg-[#080808] rounded-2xl font-mono text-sm text-blue-300/80 border border-white/5 overflow-x-auto shadow-2xl">
                        {usageCode}
                    </pre>
                </div>
            </section>

            {/* Full Module Reference */}
            <section>
                <h2 className="text-2xl font-bold mb-6">Module Reference</h2>
                <div className="space-y-4">
                    {[
                        { tag: 'Tokens', methods: ['getTokenMetrics', 'getTokenMindmap', 'predictTokens'] },
                        { tag: 'KOLs', methods: ['getFeaturedKols', 'getLeaderboard'] },
                        { tag: 'Trades', methods: ['executeSwap', 'getTradeHistory'] },
                        { tag: 'User', methods: ['getUserStats', 'getUserTrades'] },
                    ].map((m, i) => (
                        <Card key={i} className="bg-background/40 border-border/10 overflow-hidden">
                            <div className="flex items-center px-4 py-3 bg-white/5 border-b border-white/5">
                                <Badge variant="outline" className="mr-3 border-primary/40 text-primary">{m.tag}</Badge>
                                <span className="text-xs text-muted-foreground font-medium">Core client modules</span>
                            </div>
                            <CardContent className="p-4 grid grid-cols-2 gap-2">
                                {m.methods.map((method) => (
                                    <div key={method} className="text-xs font-mono text-muted-foreground flex items-center">
                                        <div className="h-1 w-1 rounded-full bg-primary/40 mr-2" />
                                        client.{method}()
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}
