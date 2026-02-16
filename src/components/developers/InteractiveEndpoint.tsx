'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/shadcn-tabs';
import { Play, Loader2, Copy, Check } from 'lucide-react';

interface InteractiveEndpointProps {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    endpoint: string;
    description: string;
    defaultParams?: Record<string, any>;
    defaultBody?: any;
}

export const InteractiveEndpoint: React.FC<InteractiveEndpointProps> = ({
    method,
    endpoint,
    description,
    defaultParams = {},
    defaultBody = {}
}) => {
    const [params, setParams] = useState(defaultParams);
    const [body, setBody] = useState(JSON.stringify(defaultBody, null, 2));
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<any>(null);
    const [apiKey, setApiKey] = useState('');
    const [jwt, setJwt] = useState('');
    const [copied, setCopied] = useState(false);

    const handleTest = async () => {
        setLoading(true);
        try {
            let url = `https://vps.kolplay.xyz/api/v1${endpoint}`;

            // Replace path parameters
            Object.entries(params).forEach(([key, value]) => {
                url = url.replace(`:${key}`, value as string);
            });

            const options: RequestInit = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (apiKey) {
                (options.headers as any)['x-api-key'] = apiKey;
            }

            if (jwt) {
                (options.headers as any)['Authorization'] = `Bearer ${jwt}`;
            }

            if (!apiKey && !jwt) {
                (options.headers as any)['x-api-key'] = 'demo_key';
            }

            if (method !== 'GET') {
                options.body = body;
            }

            const res = await fetch(url, options);
            const data = await res.json();
            setResponse(data);
        } catch (err: any) {
            setResponse({ success: false, error: err.message });
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(JSON.stringify(response, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 mt-6 mb-8">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center space-x-3">
                    <Badge variant={method === 'GET' ? 'default' : method === 'POST' ? 'secondary' : 'outline'} className="font-bold">
                        {method}
                    </Badge>
                    <CardTitle className="text-lg font-mono text-primary">{endpoint}</CardTitle>
                </div>
                <Badge variant="outline" className="text-muted-foreground">{description}</Badge>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col space-y-4">
                    <div className="flex space-x-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Input
                                placeholder="API Key (x-api-key)"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="bg-black/40 border-border/20 font-mono text-sm text-foreground focus:ring-primary/40 focus:border-primary/40"
                            />
                            <Input
                                placeholder="JWT Token (Bearer)"
                                value={jwt}
                                onChange={(e) => setJwt(e.target.value)}
                                className="bg-black/40 border-border/20 font-mono text-sm text-foreground focus:ring-primary/40 focus:border-primary/40"
                            />
                        </div>
                        <Button onClick={handleTest} disabled={loading} className="w-full">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Execute Request
                        </Button>
                    </div>

                    <Tabs defaultValue="params" className="w-full">
                        <TabsList className="bg-background/40 p-1">
                            <TabsTrigger value="params" className="px-4 py-2">Parameters</TabsTrigger>
                            {method !== 'GET' && <TabsTrigger value="body" className="px-4 py-2">Body</TabsTrigger>}
                            <TabsTrigger value="response" className="px-4 py-2" disabled={!response}>Response</TabsTrigger>
                        </TabsList>

                        <TabsContent value="params" className="pt-4 space-y-3">
                            {Object.keys(params).length > 0 ? (
                                Object.keys(params).map((key) => (
                                    <div key={key} className="flex items-center space-x-3">
                                        <label className="text-sm font-mono text-muted-foreground w-24">{key}:</label>
                                        <Input
                                            value={params[key]}
                                            onChange={(e) => setParams({ ...params, [key]: e.target.value })}
                                            className="bg-black/40 border-border/20 h-9 text-foreground focus:ring-primary/40 focus:border-primary/40"
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-muted-foreground italic">No path parameters required.</div>
                            )}
                        </TabsContent>

                        {method !== 'GET' && (
                            <TabsContent value="body" className="pt-4">
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    className="w-full h-32 bg-black/40 border border-border/20 rounded-md p-3 font-mono text-xs text-primary/80 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                            </TabsContent>
                        )}

                        <TabsContent value="response" className="pt-4 relative">
                            <div className="absolute top-2 right-2 z-10">
                                <Button variant="ghost" size="icon" onClick={copyToClipboard} className="h-8 w-8 text-muted-foreground">
                                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <pre className="w-full max-h-64 overflow-auto bg-black/60 p-4 rounded-lg font-mono text-xs text-green-400 border border-success/20">
                                {JSON.stringify(response, null, 2)}
                            </pre>
                        </TabsContent>
                    </Tabs>
                </div>
            </CardContent>
        </Card>
    );
};
