import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Zap,
    Settings2,
    Fuel,
    AlertTriangle,
    History,
    TrendingDown,
    TrendingUp,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/use-user-store';
import PortfolioService from '@/services/portfolio.service';
import { BalanceService } from '@/services/balance.service';
import { useNotifications } from '@/stores/use-ui-store';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import useTradingStore from '@/stores/use-trading-store';


interface TradeExecutionFormProps {
    mint?: string;
    symbol?: string;
    className?: string;
    currentPrice?: number;
}

export const TradeExecutionForm: React.FC<TradeExecutionFormProps> = ({
    mint,
    symbol = 'Token',
    className,
    currentPrice = 0
}) => {
    const { user } = useUserStore();
    const { isPaperTrading } = useTradingStore();
    const { showNotification } = useNotifications();


    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
    const [amount, setAmount] = useState<string>('');
    const [isExitStrategyEnabled, setIsExitStrategyEnabled] = useState(false);

    // Limit Order State
    const [targetPrice, setTargetPrice] = useState<string>('');
    const [percentChange, setPercentChange] = useState<string>('');

    // Exit Strategy State
    const [tpPercent, setTpPercent] = useState<string>('50');
    const [slPercent, setSlPercent] = useState<string>('20');
    const [trailingStop, setTrailingStop] = useState(false);
    const [trailingPercent, setTrailingPercent] = useState<string>('10');

    // Advanced Settings
    const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [slippage, setSlippage] = useState<number>(0.5);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const solPresets = [0.1, 0.2, 0.5, 1];

    useEffect(() => {
        if (currentPrice > 0 && percentChange && orderType === 'limit') {
            const percent = parseFloat(percentChange);
            if (!isNaN(percent)) {
                let customPrice = 0;
                if (side === 'buy') {
                    // Buy the Dip: Target = Current * (1 - percent/100)
                    customPrice = currentPrice * (1 - percent / 100);
                } else {
                    // Sell the Rip: Target = Current * (1 + percent/100)
                    customPrice = currentPrice * (1 + percent / 100);
                }
                setTargetPrice(customPrice.toFixed(6)); // Auto-update target price
            }
        }
    }, [percentChange, currentPrice, side, orderType]);


    const handleTrade = async () => {
        if (!amount || isNaN(Number(amount))) {
            showNotification('Error', 'Please enter a valid amount', 'error');
            return;
        }

        if (orderType === 'limit' && (!targetPrice || isNaN(Number(targetPrice)))) {
            showNotification('Error', 'Please enter a valid target price', 'error');
            return;
        }

        const walletAddress = user?.accountDetails?.address || user?.walletAddress;
        if (!walletAddress) {
            showNotification('Error', 'Wallet not connected', 'error');
            return;
        }

        // Validate Balance
        const validation = await BalanceService.validateSwap(
            walletAddress,
            mint || '',
            Number(amount),
            side === 'buy',
            0.003 // Default fee for validation
        );

        if (!validation.isValid) {
            showNotification('Validation Failed', validation.message || 'Insufficient balance', 'error');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload: any = {
                mint,
                amount: Number(amount),
                tradeType: side,
                slippage,
                priority,
                watchConfig: isExitStrategyEnabled ? {
                    takeProfitPercentage: Number(tpPercent),
                    stopLossPercentage: Number(slPercent),
                    enableTrailingStop: trailingStop,
                    trailingPercentage: Number(trailingPercent),
                    maxHoldTimeMinutes: 1440
                } : undefined
            };

            if (orderType === 'limit') {
                payload.limitPrice = Number(targetPrice);
            }

            const res = await PortfolioService.performSwap(payload);

            if (res.data?.success || res.success) {
                showNotification('Success', `${side === 'buy' ? 'Bought' : 'Sold'} ${symbol} successfully!`, 'success');
                setAmount(''); // Clear amount on success
            } else {
                showNotification('Trade Failed', res.message || 'Transaction not confirmed', 'error');
            }
        } catch (e: any) {
            console.error(e);
            showNotification('Trade Failed', e.message || 'An unexpected error occurred', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const walletAddress = user?.accountDetails?.address || user?.walletAddress;

    return (
        <Card className={cn("bg-card/50 border-border h-full flex flex-col", className)}>
            <CardHeader className="p-4 border-b border-border space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="bg-primary/20 p-1.5 rounded-lg">
                            <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <CardTitle className="text-sm font-bold uppercase tracking-tight">Trade {symbol}</CardTitle>
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <Settings2 className="w-4 h-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80 bg-card border-border shadow-xl backdrop-blur-xl p-4 space-y-4">
                            <div className="space-y-2">
                                <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Trade Settings</h4>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold">Priority</Label>
                                            <span className="text-[10px] text-muted-foreground uppercase">{priority}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {(['low', 'medium', 'high'] as const).map((p) => (
                                                <Button
                                                    key={p}
                                                    variant={priority === p ? "default" : "outline"}
                                                    size="sm"
                                                    className="flex-1 h-7 text-[10px] font-bold uppercase"
                                                    onClick={() => setPriority(p)}
                                                >
                                                    {p}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-border/50 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold">Slippage (%)</Label>
                                            <span className="text-[10px] text-muted-foreground">{slippage}%</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {[0.5, 1, 3].map((slp) => (
                                                <Button
                                                    key={slp}
                                                    variant={slippage === slp ? "default" : "outline"}
                                                    size="sm"
                                                    className="flex-1 h-7 text-[10px] font-bold"
                                                    onClick={() => setSlippage(slp)}
                                                >
                                                    {slp}
                                                </Button>
                                            ))}
                                            <Input
                                                className="w-20 h-7 text-[10px] font-bold bg-background"
                                                placeholder="Custom"
                                                value={slippage}
                                                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Wallet Info */}
                <div className="bg-muted/30 rounded-xl p-3 flex items-center justify-between border border-border/50">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-[#9945FF] rounded-full flex items-center justify-center">
                            <img src="/solana-logo.png" className="w-5 h-5" alt="Solana" />
                        </div>
                        <div>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1">
                                App Wallet
                                {isPaperTrading && (
                                    <Badge variant="outline" className="px-1 h-3 text-[7px] border-amber-500/50 text-amber-500 uppercase bg-transparent">Paper</Badge>
                                )}
                            </div>
                            <div className="text-xs font-mono text-foreground font-bold">
                                {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'No Wallet'}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-muted-foreground font-bold uppercase">
                            {isPaperTrading ? 'Paper Balance' : 'Balance'}
                        </div>
                        <div className="text-xs font-bold text-foreground">
                            {(user?.accountDetails?.balance || 0).toFixed(isPaperTrading ? 6 : 4)} SOL
                        </div>
                    </div>

                </div>
            </CardHeader>

            <CardContent className="p-4 flex-1 space-y-4 overflow-y-auto">
                {/* Buy/Sell/OrderType Toggles */}
                <div className="flex p-1 bg-muted/30 rounded-xl border border-border/50">
                    <button
                        onClick={() => setSide('buy')}
                        className={cn(
                            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                            side === 'buy' ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        BUY
                    </button>
                    <button
                        onClick={() => setSide('sell')}
                        className={cn(
                            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                            side === 'sell' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        SELL
                    </button>
                    <div className="w-px bg-border mx-1 my-1" />
                    <select
                        value={orderType}
                        onChange={(e) => setOrderType(e.target.value as any)}
                        className="bg-transparent text-xs font-bold outline-none px-2 text-foreground"
                    >
                        <option value="market">MARKET</option>
                        <option value="limit">LIMIT</option>
                    </select>
                </div>

                {/* Limit Order Logic */}
                {orderType === 'limit' && (
                    <div className="space-y-3 bg-muted/20 p-3 rounded-xl border border-border/50">
                        <div className="flex items-center gap-2">
                            {side === 'buy' ? <TrendingDown className="w-4 h-4 text-green-500" /> : <TrendingUp className="w-4 h-4 text-green-500" />}
                            <span className="text-xs font-bold uppercase">{side === 'buy' ? 'Buy the Dip' : 'Sell the Rip'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-[10px] text-muted-foreground font-bold uppercase">{side === 'buy' ? '% Drop' : '% Gain'}</Label>
                                <div className="relative">
                                    <Input
                                        placeholder="10"
                                        value={percentChange}
                                        onChange={(e) => setPercentChange(e.target.value)}
                                        className="h-9 font-bold pr-6"
                                    />
                                    <span className="absolute right-2 top-2.5 text-xs text-muted-foreground">%</span>
                                </div>
                            </div>
                            <div>
                                <Label className="text-[10px] text-muted-foreground font-bold uppercase">Target Price</Label>
                                <Input
                                    placeholder="0.00"
                                    value={targetPrice}
                                    onChange={(e) => setTargetPrice(e.target.value)}
                                    className="h-9 font-bold"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Amount Input */}
                <div className="space-y-2">
                    <div className="relative">
                        <Input
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-12 bg-background border-border text-foreground text-lg font-bold pr-12 rounded-xl focus-visible:ring-primary"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                            SOL
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {solPresets.map(val => (
                            <Button
                                key={val}
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-8 font-bold border-border/50 bg-muted/10 hover:bg-primary/10 hover:border-primary/50"
                                onClick={() => setAmount(val.toString())}
                            >
                                {val}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Exit Strategy */}
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="exit-strategy"
                                checked={isExitStrategyEnabled}
                                onCheckedChange={setIsExitStrategyEnabled}
                            />
                            <Label htmlFor="exit-strategy" className="text-xs font-bold uppercase tracking-tight cursor-pointer">
                                Exit Strategy
                            </Label>
                        </div>
                        <History className="w-4 h-4 text-muted-foreground" />
                    </div>

                    {isExitStrategyEnabled && (
                        <div className="bg-muted/20 border border-border p-3 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground font-bold uppercase">Take Profit %</Label>
                                    <Input
                                        type="number"
                                        value={tpPercent}
                                        onChange={(e) => setTpPercent(e.target.value)}
                                        className="h-9 bg-background border-border text-xs font-bold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground font-bold uppercase">Stop Loss %</Label>
                                    <Input
                                        type="number"
                                        value={slPercent}
                                        onChange={(e) => setSlPercent(e.target.value)}
                                        className="h-9 bg-background border-border text-xs font-bold"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="trailing-stop"
                                        checked={trailingStop}
                                        onCheckedChange={setTrailingStop}
                                    />
                                    <Label htmlFor="trailing-stop" className="text-[10px] font-bold uppercase cursor-pointer">Trailing Stop</Label>
                                </div>
                                {trailingStop && (
                                    <Input
                                        type="number"
                                        value={trailingPercent}
                                        onChange={(e) => setTrailingPercent(e.target.value)}
                                        className="h-8 w-16 bg-background border-border text-xs font-bold"
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Gas & Slippage */}
                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground pt-2">
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                            <Fuel className="w-3 h-3" />
                            <span className="uppercase">Priority:</span>
                            <span className="text-foreground uppercase">{priority}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span className="uppercase">Slippage:</span>
                            <span className="text-foreground">{slippage}%</span>
                        </div>
                    </div>
                    <button className="text-primary hover:underline">Auto</button>
                </div>
            </CardContent>

            <div className="p-4 border-t border-border bg-muted/20">
                <Button
                    className={cn(
                        "w-full h-14 text-sm font-black uppercase tracking-[0.1em] rounded-xl shadow-xl transition-all active:scale-[0.98]",
                        side === 'buy' ? "bg-green-500 hover:bg-green-600 shadow-green-500/20" : "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                    )}
                    onClick={handleTrade}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            PROCESSING...
                        </>
                    ) : (
                        `${side.toUpperCase()} ${symbol}`
                    )}
                </Button>
            </div>
        </Card>
    );
};
