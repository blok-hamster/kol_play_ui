'use client';

import React from 'react';
import { InteractiveEndpoint } from '@/components/developers/InteractiveEndpoint';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ApiDocsPage() {
    return (
        <div className="space-y-12 pb-24">
            {/* Hero Section */}
            <section>
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    API Documentation
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                    The KOLPLAY Developer API allows you to build powerful trading tools, analytics, and social applications on top of our real-time engine.
                </p>
            </section>

            {/* Base URL */}
            <section id="base-url">
                <h2 className="text-2xl font-bold mb-4 border-b border-border/20 pb-2">Base URL</h2>
                <Card className="bg-black/40 border-primary/20">
                    <CardContent className="p-4 font-mono text-primary text-sm">
                        https://vps.kolplay.xyz/api/v1
                    </CardContent>
                </Card>
            </section>

            {/* Authentication */}
            <section id="authentication">
                <h2 className="text-2xl font-bold mb-4 border-b border-border/20 pb-2">Authentication</h2>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Include your API key in the <code className="text-primary italic">x-api-key</code> header for all REST requests.
                    </p>
                    <pre className="p-4 bg-black/60 rounded-lg text-xs font-mono text-muted-foreground border border-border/10">
                        {`const response = await axios.get('https://vps.kolplay.xyz/api/v1/user/stats', {
  headers: { 'x-api-key': 'your_api_key_here' }
});`}
                    </pre>
                </div>
            </section>

            {/* Token Endpoints */}
            <section id="tokens">
                <h2 className="text-3xl font-bold mb-8 text-primary/80">1. Tokens</h2>

                <div className="space-y-16">
                    {/* Get Token Metrics */}
                    <div>
                        <h3 className="text-xl font-bold mb-2">Get Token Metrics</h3>
                        <p className="text-sm text-muted-foreground mb-4">Returns real-time on-chain metrics for a specific token mint.</p>
                        <InteractiveEndpoint
                            method="GET"
                            endpoint="/tokens/:mint/metrics"
                            description="Real-time on-chain data"
                            defaultParams={{ mint: 'So11111111111111111111111111111111111111112' }}
                        />
                    </div>

                    {/* Get Token Mindmap */}
                    <div>
                        <h3 className="text-xl font-bold mb-2">Get Token Mindmap</h3>
                        <p className="text-sm text-muted-foreground mb-4">Fetches social mindmap data illustrating KOL involvement and social weight.</p>
                        <InteractiveEndpoint
                            method="GET"
                            endpoint="/tokens/:mint/mindmap"
                            description="Social influence & KOL network"
                            defaultParams={{ mint: 'So11111111111111111111111111111111111111112' }}
                        />
                    </div>

                    {/* Predict Token */}
                    <div>
                        <h3 className="text-xl font-bold mb-2">Predict Token Performance</h3>
                        <p className="text-sm text-muted-foreground mb-4">Get AI-powered trade predictions for a list of tokens.</p>
                        <InteractiveEndpoint
                            method="POST"
                            endpoint="/tokens/predict"
                            description="AI Confidence & Recommendations"
                            defaultBody={{ mints: ["So11111111111111111111111111111111111111112"] }}
                        />
                    </div>
                </div>
            </section>

            {/* Trade Endpoints */}
            <section id="trades">
                <h2 className="text-3xl font-bold mb-8 text-primary/80">2. Trades</h2>
                <div className="space-y-16">
                    {/* Execute Swap */}
                    <div>
                        <h3 className="text-xl font-bold mb-2">Execute Swap</h3>
                        <p className="text-sm text-muted-foreground mb-4">Queue an on-chain trade through the KOLPLAY execution engine.</p>
                        <InteractiveEndpoint
                            method="POST"
                            endpoint="/trades/swap"
                            description="On-chain execution"
                            defaultBody={{
                                mint: "So11111111111111111111111111111111111111112",
                                amount: 0.1,
                                tradeType: "buy",
                                isSimulation: true
                            }}
                        />
                    </div>
                </div>
            </section>

            {/* WebSockets Section */}
            <section id="websockets">
                <h2 className="text-2xl font-bold mb-4 border-b border-border/20 pb-2">WebSockets</h2>
                <div className="space-y-6">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Real-time updates for trades and mindmap changes are delivered via Socket.IO.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-background/20 border-border/20">
                            <CardContent className="p-4">
                                <Badge variant="secondary" className="mb-2">Event</Badge>
                                <div className="font-mono text-sm text-primary mb-2">kol_trade_update</div>
                                <p className="text-xs text-muted-foreground">Broadcasts when any KOL executes a trade.</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-background/20 border-border/20">
                            <CardContent className="p-4">
                                <Badge variant="secondary" className="mb-2">Event</Badge>
                                <div className="font-mono text-sm text-primary mb-2">mindmap_update</div>
                                <p className="text-xs text-muted-foreground">Fired when a token's social score shifts.</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>
        </div>
    );
}
