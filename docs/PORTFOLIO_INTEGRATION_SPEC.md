# Portfolio Page - Trade History Integration Specification

## Overview
This document specifies the integration of the new Trade History API endpoints into the portfolio page, replacing the old transaction-based system with the new trade-based system.

## Key Changes

### 1. Data Model Shift
- **Old**: Transaction-based (buy/sell events)
- **New**: Trade-based (open positions with lifecycle tracking)

### 2. New Features to Add
1. **Open Positions Section** - Display active trades with real-time P&L
2. **Closed Trades Section** - Historical trades with realized P&L
3. **Enhanced Trade Stats** - Using new `/api/features/get-user-trade-stats` endpoint
4. **Trade Details Modal** - Detailed view of individual trades

### 3. Components to Update

#### A. Main Portfolio Page (`src/app/portfolio/page.tsx`)
**New Sections:**
- Open Positions (replaces/enhances Token Holdings)
- Recent Closed Trades (replaces Recent Transactions)
- Enhanced Portfolio Metrics

**API Endpoints to Use:**
```typescript
// Replace getUserTransactions with:
PortfolioService.getOpenTrades() // For open positions
PortfolioService.getUserTrades('closed') // For recent closed trades
PortfolioService.getUserTradeStatsNew() // For enhanced stats
```

#### B. Trading Stats Component (`src/components/portfolio/trading-stats.tsx`)
**Updates:**
- Use new `getUserTradeStatsNew()` endpoint
- Display additional metrics: averageHoldTime, largestWin, largestLoss
- Show open vs closed trades breakdown

#### C. Transaction History Component (`src/components/portfolio/transaction-history.tsx`)
**Updates:**
- Add toggle to switch between "Transactions" and "Trades" view
- Integrate `queryTrades()` for advanced filtering
- Display trade lifecycle information

## Detailed Implementation Plan

### Phase 1: Update Portfolio Service (COMPLETED)
✅ Added new Trade History endpoints to constants
✅ Added new types (TradeHistoryEntry, TradeStats, etc.)
✅ Added new methods to PortfolioService

### Phase 2: Create Open Positions Component
**File**: `src/components/portfolio/open-positions.tsx`

**Features:**
- List all open trades
- Show entry price, current price, unrealized P&L
- Display sell conditions (take profit, stop loss)
- Color-coded P&L (green/red)
- Time since opened
- Token metadata integration

**Data Structure:**
```typescript
interface OpenPosition {
  trade: TradeHistoryEntry;
  tokenMetadata?: TokenMetadata;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  holdTime: string; // formatted duration
}
```

### Phase 3: Create Closed Trades Component
**File**: `src/components/portfolio/closed-trades.tsx`

**Features:**
- List recent closed trades
- Show realized P&L
- Display sell reason (take_profit, stop_loss, manual, etc.)
- Hold time duration
- Entry/exit prices

### Phase 4: Update Main Portfolio Page
**Changes to `src/app/portfolio/page.tsx`:**

1. **Replace Token Holdings Section** with Open Positions
2. **Replace Recent Transactions** with Recent Closed Trades
3. **Update Portfolio Metrics** to use TradeStats
4. **Add Trade Summary Cards**:
   - Total Open Positions
   - Total Closed Trades
   - Win Rate
   - Average Hold Time

### Phase 5: Update Trading Stats Page
**Changes to `src/components/portfolio/trading-stats.tsx`:**

1. Replace `getUserTradeStats()` with `getUserTradeStatsNew()`
2. Add new metrics:
   - Average Hold Time (in hours/days)
   - Largest Win (SOL + %)
   - Largest Loss (SOL + %)
   - Average Win Amount
   - Average Loss Amount
3. Add timeframe filtering (7d, 30d, 90d, all)

### Phase 6: Enhance Transaction History
**Changes to `src/components/portfolio/transaction-history.tsx`:**

1. Add view toggle: "Transactions" vs "Trades"
2. When in "Trades" view:
   - Use `queryTrades()` endpoint
   - Show trade lifecycle (open → closed)
   - Display hold time
   - Show sell conditions
3. Enhanced filtering:
   - Filter by status (open/closed)
   - Filter by P&L range
   - Filter by tags

## Design Updates

### Color Scheme for Trade Status
```typescript
const tradeStatusColors = {
  open: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800'
  },
  closed: {
    bg: 'bg-gray-100 dark:bg-gray-900/20',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-800'
  },
  failed: {
    bg: 'bg-red-100 dark:bg-red-900/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800'
  }
};
```

### P&L Display Format
```typescript
// Positive P&L
<span className="text-green-600 dark:text-green-400 font-bold">
  +{formatCurrency(pnl)} ({formatPercentage(pnlPercent)})
</span>

// Negative P&L
<span className="text-red-600 dark:text-red-400 font-bold">
  {formatCurrency(pnl)} ({formatPercentage(pnlPercent)})
</span>
```

### Trade Card Layout
```
┌─────────────────────────────────────────────────┐
│ [Token Icon] TOKEN_SYMBOL                       │
│              Token Name                         │
│                                                 │
│ Entry: $0.05  →  Current: $0.075  [+50%]      │
│ Amount: 1000 tokens                            │
│ Value: $50 → $75                               │
│                                                 │
│ TP: +20% | SL: -10% | Hold: 2h 15m           │
└─────────────────────────────────────────────────┘
```

## API Response Handling

### Error Handling
```typescript
try {
  const openTrades = await PortfolioService.getOpenTrades();
  setOpenPositions(openTrades.data);
} catch (error) {
  console.error('Failed to fetch open trades:', error);
  showError('Error', 'Failed to load open positions');
  // Fallback to empty array
  setOpenPositions([]);
}
```

### Loading States
```typescript
const [isLoadingOpenTrades, setIsLoadingOpenTrades] = useState(true);
const [isLoadingClosedTrades, setIsLoadingClosedTrades] = useState(true);
const [isLoadingStats, setIsLoadingStats] = useState(true);
```

## Data Transformation

### Calculate Unrealized P&L
```typescript
function calculateUnrealizedPnL(trade: TradeHistoryEntry) {
  if (!trade.currentPrice || trade.status !== 'open') return null;
  
  const currentValue = trade.entryAmount * trade.currentPrice;
  const unrealizedPnL = currentValue - trade.entryValue;
  const unrealizedPnLPercentage = (unrealizedPnL / trade.entryValue) * 100;
  
  return {
    unrealizedPnL,
    unrealizedPnLPercentage,
    currentValue
  };
}
```

### Format Hold Time
```typescript
function formatHoldTime(openedAt: Date | string): string {
  const opened = new Date(openedAt);
  const now = new Date();
  const diffMs = now.getTime() - opened.getTime();
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  return `${hours}h ${minutes}m`;
}
```

## Testing Checklist

- [ ] Open positions display correctly
- [ ] Closed trades show realized P&L
- [ ] Trade stats update with new endpoint
- [ ] Filtering works in transaction history
- [ ] Error states handled gracefully
- [ ] Loading states display properly
- [ ] Mobile responsive design
- [ ] Token metadata enrichment works
- [ ] P&L calculations are accurate
- [ ] Hold time formatting is correct

## Migration Notes

### Backward Compatibility
- Keep old transaction endpoints as fallback
- Gracefully handle missing trade data
- Support both old and new data formats

### Data Consistency
- Ensure trade IDs match transaction IDs where applicable
- Validate P&L calculations against old system
- Cross-reference open trades with wallet holdings

## Next Steps

1. Implement Open Positions component
2. Implement Closed Trades component
3. Update main portfolio page
4. Update trading stats component
5. Enhance transaction history
6. Test all integrations
7. Deploy and monitor

