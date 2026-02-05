# Quick Start Guide - Portfolio Trade History Integration

## What Was Done

I've integrated the new Trade History API endpoints into your portfolio system. Here's what's ready to use:

### ✅ Completed

1. **API Configuration** - All 6 new endpoints added to constants
2. **Type Definitions** - Complete TypeScript types for trade data
3. **Service Layer** - 7 new methods in PortfolioService
4. **Open Positions Component** - Shows active trades with real-time P&L
5. **Closed Trades Component** - Shows completed trades with realized P&L
6. **Documentation** - Complete specs and guides

### 📦 New Components Ready to Use

#### 1. Open Positions Component
```typescript
import OpenPositions from '@/components/portfolio/open-positions';

<OpenPositions 
  limit={5}                    // Optional: number of trades to show
  showHeader={true}            // Optional: show/hide header
  onTradeClick={(trade) => {   // Optional: handle trade clicks
    console.log('Trade clicked:', trade);
  }}
/>
```

**Features:**
- Real-time unrealized P&L
- Entry/current price comparison
- Sell conditions (TP, SL, trailing stop)
- Hold time tracking
- Token metadata with images
- Responsive design

#### 2. Closed Trades Component
```typescript
import ClosedTrades from '@/components/portfolio/closed-trades';

<ClosedTrades 
  limit={5}                    // Optional: number of trades to show
  showHeader={true}            // Optional: show/hide header
  onTradeClick={(trade) => {   // Optional: handle trade clicks
    console.log('Trade clicked:', trade);
  }}
/>
```

**Features:**
- Realized P&L display
- Entry/exit price comparison
- Sell reason badges
- Hold time duration
- Transaction links to Solscan
- Responsive design

### 🔌 New API Methods Available

```typescript
import { PortfolioService } from '@/services/portfolio.service';

// Get all open trades
const openTrades = await PortfolioService.getOpenTrades();

// Get closed trades
const closedTrades = await PortfolioService.getUserTrades('closed');

// Get all trades (open + closed)
const allTrades = await PortfolioService.getUserTrades();

// Get trades for specific token
const tokenTrades = await PortfolioService.getTradesByToken(tokenMint);

// Get enhanced trade stats with date filtering
const stats = await PortfolioService.getUserTradeStatsNew(startDate, endDate);

// Query trades with advanced filters
const filteredTrades = await PortfolioService.queryTrades({
  status: 'closed',
  minPnL: 0,
  limit: 50
});

// Get system-wide trade stats
const systemStats = await PortfolioService.getTradeHistoryStats();
```

## Next Steps

### Step 1: Update Main Portfolio Page

Open `src/app/portfolio/page.tsx` and make these changes:

1. **Add imports at the top:**
```typescript
import OpenPositions from '@/components/portfolio/open-positions';
import ClosedTrades from '@/components/portfolio/closed-trades';
```

2. **Replace the Token Holdings section** (around line 500-700):
```typescript
{/* OLD: Token Holdings */}
<div className="bg-background border border-border rounded-xl p-4 sm:p-6 shadow-lg">
  {/* ... old token holdings code ... */}
</div>

{/* NEW: Open Positions */}
<div className="bg-background border border-border rounded-xl p-4 sm:p-6 shadow-lg">
  <OpenPositions limit={5} showHeader={true} />
</div>
```

3. **Replace the Recent Transactions section** (around line 800-1000):
```typescript
{/* OLD: Recent Transactions */}
<div className="bg-background border border-border rounded-xl p-4 sm:p-6 shadow-lg">
  {/* ... old transactions code ... */}
</div>

{/* NEW: Closed Trades */}
<div className="bg-background border border-border rounded-xl p-4 sm:p-6 shadow-lg">
  <ClosedTrades limit={5} showHeader={true} />
</div>
```

### Step 2: Update Trading Stats Component

Open `src/components/portfolio/trading-stats.tsx` and:

1. **Update the API call** (around line 50):
```typescript
// OLD:
const response = await PortfolioService.getUserTradeStats();

// NEW:
const response = await PortfolioService.getUserTradeStatsNew(startDate, endDate);
```

2. **Add new metric cards** - See `TRADING_STATS_UPDATE_GUIDE.md` for complete code

### Step 3: Test Everything

```bash
# Run type check
npm run type-check

# Run linter
npm run lint

# Start dev server
npm run dev
```

Visit `http://localhost:3000/portfolio` and verify:
- ✅ Open positions display correctly
- ✅ Closed trades display correctly
- ✅ P&L calculations are accurate
- ✅ No console errors
- ✅ Mobile responsive

## File Structure

```
src/
├── lib/
│   └── constants.ts                          ✅ Updated
├── types/
│   └── index.ts                              ✅ Updated
├── services/
│   └── portfolio.service.ts                  ✅ Updated
├── components/
│   └── portfolio/
│       ├── open-positions.tsx                ✅ New
│       ├── closed-trades.tsx                 ✅ New
│       ├── trading-stats.tsx                 ⏳ To Update
│       └── transaction-history.tsx           ⏳ Optional Update
└── app/
    └── portfolio/
        └── page.tsx                          ⏳ To Update
```

## API Endpoints Reference

### Base URL
All endpoints are prefixed with: `/api/features/`

### Available Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/trade-history/:tradeId` | GET | Get specific trade |
| `/trade-history` | GET | Get user trades |
| `/trade-history?status=open` | GET | Get open trades only |
| `/trade-history?status=closed` | GET | Get closed trades only |
| `/trade-history/token/:tokenMint` | GET | Get trades for token |
| `/trade-history/open` | GET | Get open trades (alias) |
| `/get-user-trade-stats` | GET | Get trade statistics |
| `/trade-history/query` | POST | Advanced trade filtering |
| `/trade-history-stats` | GET | System-wide stats |

## Type Definitions

### TradeHistoryEntry
```typescript
interface TradeHistoryEntry {
  id: string;
  agentId: string;
  tokenMint: string;
  status: 'open' | 'closed' | 'failed';
  openedAt: Date | string;
  closedAt?: Date | string;
  entryPrice: number;
  entryAmount: number;
  entryValue: number;
  exitPrice?: number;
  exitAmount?: number;
  exitValue?: number;
  realizedPnL?: number;
  realizedPnLPercentage?: number;
  currentPrice?: number;
  sellConditions: {
    takeProfitPercentage?: number;
    stopLossPercentage?: number;
    trailingStopPercentage?: number;
    maxHoldTimeMinutes?: number;
  };
  sellReason?: string;
  tags?: string[];
  // ... more fields
}
```

### TradeStats
```typescript
interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averagePnL: number;
  largestWin: number;
  largestLoss: number;
  averageHoldTime: number; // in minutes
}
```

## Troubleshooting

### Issue: Components not displaying
**Solution**: Check that the API endpoints are returning data. Open browser console and look for errors.

### Issue: TypeScript errors
**Solution**: Run `npm run type-check` to see specific errors. Make sure all imports are correct.

### Issue: Token images not loading
**Solution**: This is normal for some tokens. The component has fallback handling.

### Issue: P&L calculations seem wrong
**Solution**: Verify that `currentPrice` is being updated for open trades. Check the API response.

## Support Files

- `PORTFOLIO_INTEGRATION_SPEC.md` - Complete technical specification
- `TRADING_STATS_UPDATE_GUIDE.md` - Detailed update instructions
- `IMPLEMENTATION_SUMMARY.md` - Full implementation details

## Questions?

Check the documentation files or review the component code. All components are fully commented and follow React best practices.

