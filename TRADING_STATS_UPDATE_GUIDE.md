# Trading Stats Component Update Guide

## File: `src/components/portfolio/trading-stats.tsx`

### Changes Required

#### 1. Update API Call
Replace the old `getUserTradeStats()` with the new `getUserTradeStatsNew()`:

```typescript
// OLD:
const response = await PortfolioService.getUserTradeStats();

// NEW:
const response = await PortfolioService.getUserTradeStatsNew(startDate, endDate);
```

#### 2. Add Date Range State
```typescript
const [dateRange, setDateRange] = useState<{
  startDate?: string;
  endDate?: string;
}>({});
```

#### 3. Update fetchTradingStats Function
```typescript
const fetchTradingStats = async () => {
  try {
    setIsLoading(true);
    setError(null);

    // Calculate date range based on selected timeframe
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (selectedTimeframe !== 'all') {
      const now = new Date();
      endDate = now.toISOString();
      
      const days = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
      }[selectedTimeframe] || 0;
      
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    }

    const response = await PortfolioService.getUserTradeStatsNew(startDate, endDate);
    setTradeStats(response.data);
  } catch (err: any) {
    console.error('Failed to fetch trading stats:', err);
    setError(err.message || 'Failed to load trading statistics');
    showNotification('Error', 'Failed to load trading statistics', 'error');
  } finally {
    setIsLoading(false);
  }
};
```

#### 4. Add New Metric Cards

Add these new cards to the statistics grid:

```typescript
{/* Average Hold Time */}
<div className="bg-muted/50 rounded-lg p-4 sm:p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-medium text-muted-foreground">
      Avg Hold Time
    </h3>
    <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
  </div>
  <p className="text-2xl sm:text-3xl font-bold text-foreground">
    {formatHoldTime(tradeStats?.averageHoldTime || 0)}
  </p>
  <p className="text-sm text-muted-foreground mt-2">Per trade</p>
</div>

{/* Largest Win */}
<div className="bg-muted/50 rounded-lg p-4 sm:p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-medium text-muted-foreground">
      Largest Win
    </h3>
    <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
  </div>
  <p className="text-2xl sm:text-3xl font-bold text-green-600">
    +{formatCurrency(tradeStats?.largestWin || 0)}
  </p>
  <p className="text-sm text-muted-foreground mt-2">Best trade</p>
</div>

{/* Largest Loss */}
<div className="bg-muted/50 rounded-lg p-4 sm:p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-medium text-muted-foreground">
      Largest Loss
    </h3>
    <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
  </div>
  <p className="text-2xl sm:text-3xl font-bold text-red-600">
    {formatCurrency(tradeStats?.largestLoss || 0)}
  </p>
  <p className="text-sm text-muted-foreground mt-2">Worst trade</p>
</div>

{/* Open vs Closed Breakdown */}
<div className="bg-muted/50 rounded-lg p-4 sm:p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-medium text-muted-foreground">
      Trade Status
    </h3>
    <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
  </div>
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Open</span>
      <span className="text-sm font-bold text-blue-600">
        {tradeStats?.openTrades || 0}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Closed</span>
      <span className="text-sm font-bold text-foreground">
        {tradeStats?.closedTrades || 0}
      </span>
    </div>
  </div>
</div>
```

#### 5. Add Helper Function for Hold Time Formatting

```typescript
const formatHoldTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  
  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
};
```

#### 6. Update Type Usage

The new `TradeStats` type includes:
- `openTrades: number`
- `closedTrades: number`
- `winningTrades: number`
- `losingTrades: number`
- `averageHoldTime: number` (in minutes)
- `largestWin: number`
- `largestLoss: number`
- `averageWinAmount?: number`
- `averageLossAmount?: number`
- `totalPnLPercentage?: number`
- `averagePnLPercentage?: number`

### Complete Updated Grid Layout

The statistics grid should now have 12 cards in this order:
1. Total Trades
2. Win Rate
3. Total P&L
4. Unique Tokens
5. Average Trade Size
6. SOL Spent
7. SOL Received
8. Trading Period
9. Average Hold Time (NEW)
10. Largest Win (NEW)
11. Largest Loss (NEW)
12. Trade Status (Open/Closed) (NEW)

### Mobile Responsiveness

Update the grid classes:
```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
```

This ensures proper layout on all screen sizes.

