# Trade History API Endpoints

This document describes the new Trade History API endpoints added to the features controller.

## Endpoints

### 1. Get Trade by ID
**GET** `/api/features/trade-history/:tradeId`

Get a specific trade by its ID.

**Authentication:** JWT or API Key

**Parameters:**
- `tradeId` (path parameter) - Trade ID

**Response:**
```json
{
  "message": "Trade fetched successfully",
  "data": {
    "id": "trade_1234567890_abc123",
    "agentId": "user_123",
    "tokenMint": "TokenMintAddress...",
    "status": "open",
    "entryPrice": 0.05,
    "entryAmount": 100,
    "currentPrice": 0.075,
    ...
  }
}
```

---

### 2. Get User Trades
**GET** `/api/features/trade-history`

Get all trades for the authenticated user.

**Authentication:** JWT or API Key

**Query Parameters:**
- `status` (optional) - Filter by status: `"open"` or `"closed"`

**Response:**
```json
{
  "message": "User trades fetched successfully",
  "data": [
    {
      "id": "trade_1234567890_abc123",
      "status": "open",
      ...
    }
  ]
}
```

---

### 3. Get Trades by Token
**GET** `/api/features/trade-history/token/:tokenMint`

Get all trades for a specific token.

**Authentication:** JWT or API Key

**Parameters:**
- `tokenMint` (path parameter) - Token mint address

**Response:**
```json
{
  "message": "Token trades fetched successfully",
  "data": [...]
}
```

---

### 4. Get Open Trades
**GET** `/api/features/trade-history/open`

Get all open trades for the authenticated user.

**Authentication:** JWT or API Key

**Response:**
```json
{
  "message": "Open trades fetched successfully",
  "data": [...]
}
```

---

### 5. Get User Trade Stats
**GET** `/api/features/get-user-trade-stats`

Get trading statistics for the authenticated user.

**Authentication:** JWT

**Query Parameters:**
- `startDate` (optional) - Start date (ISO string)
- `endDate` (optional) - End date (ISO string)

**Response:**
```json
{
  "message": "User trade stats fetched successfully",
  "data": {
    "totalTrades": 150,
    "openTrades": 5,
    "closedTrades": 145,
    "winningTrades": 90,
    "losingTrades": 55,
    "winRate": 62.07,
    "totalPnL": 15.5,
    "averagePnL": 0.107,
    "largestWin": 2.5,
    "largestLoss": 0.8,
    "averageHoldTime": 120.5
  }
}
```

---

### 6. Query Trades
**POST** `/api/features/trade-history/query`

Query trades with advanced filters.

**Authentication:** JWT or API Key

**Request Body:**
```json
{
  "tokenMint": "TokenMintAddress...",
  "status": "closed",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "minPnL": 0,
  "maxPnL": 10,
  "tags": ["copy_trade"],
  "limit": 50,
  "offset": 0
}
```

**Response:**
```json
{
  "message": "Trades queried successfully",
  "data": [...]
}
```

---

### 7. Update Trade Price
**PUT** `/api/features/trade-history/price`

Update the current price of an open trade.

**Authentication:** JWT or API Key

**Request Body:**
```json
{
  "tradeId": "trade_1234567890_abc123",
  "currentPrice": 0.085
}
```

**Response:**
```json
{
  "message": "Trade price updated successfully",
  "data": {
    "success": true,
    "message": "Trade price updated"
  }
}
```

---

### 8. Close Trade
**PUT** `/api/features/trade-history/close`

Close a trade.

**Authentication:** JWT or API Key

**Request Body:**
```json
{
  "tradeId": "trade_1234567890_abc123",
  "exitPrice": 0.075,
  "exitAmount": 100,
  "sellTransactionId": "tx_signature...",
  "sellReason": "take_profit"
}
```

**Response:**
```json
{
  "message": "Trade closed successfully",
  "data": {
    "id": "trade_1234567890_abc123",
    "status": "closed",
    "realizedPnL": 2.5,
    "realizedPnLPercentage": 50.0,
    ...
  }
}
```

---

### 9. Delete Trade
**DELETE** `/api/features/trade-history/:tradeId`

Delete a trade (admin function).

**Authentication:** JWT

**Parameters:**
- `tradeId` (path parameter) - Trade ID

**Response:**
```json
{
  "message": "Trade deleted successfully",
  "data": {
    "success": true,
    "message": "Trade deleted"
  }
}
```

---

### 10. Get Trade History Stats
**GET** `/api/features/trade-history-stats`

Get overall trade history storage statistics.

**Authentication:** JWT or API Key

**Response:**
```json
{
  "message": "Trade history stats fetched successfully",
  "data": {
    "totalTrades": 500,
    "openTrades": 25,
    "closedTrades": 475,
    "agents": 10,
    "tokens": 150
  }
}
```

---

## Type Definitions

### TradeHistoryEntry
```typescript
interface TradeHistoryEntry {
  id: string;
  agentId: string;
  tokenMint: string;
  status: 'open' | 'closed' | 'failed';
  openedAt: Date;
  closedAt?: Date;
  entryPrice: number;
  entryAmount: number;
  entryValue: number;
  buyTransactionId?: string;
  exitPrice?: number;
  exitAmount?: number;
  exitValue?: number;
  sellTransactionId?: string;
  sellReason?: string;
  realizedPnL?: number;
  realizedPnLPercentage?: number;
  highestPrice?: number;
  lowestPrice?: number;
  currentPrice?: number;
  lastPriceUpdate?: Date;
  sellConditions: {
    takeProfitPercentage?: number;
    stopLossPercentage?: number;
    trailingStopPercentage?: number;
    maxHoldTimeMinutes?: number;
  };
  ledgerId?: string;
  originalTradeId?: string;
  watchJobId?: string;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
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
  totalPnLPercentage: number;
  averagePnL: number;
  averagePnLPercentage: number;
  averageWinAmount: number;
  averageLossAmount: number;
  largestWin: number;
  largestLoss: number;
  averageHoldTime: number; // in minutes
}
```

### TradeHistoryStatsResponse
```typescript
interface TradeHistoryStatsResponse {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  agents: number;
  tokens: number;
}
```

---

## Usage Examples

### Get User's Open Trades
```javascript
const response = await fetch('/api/features/trade-history/open', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log(data.data); // Array of open trades
```

### Query Winning Trades
```javascript
const response = await fetch('/api/features/trade-history/query', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'closed',
    minPnL: 0,
    limit: 10
  })
});
const data = await response.json();
console.log(data.data); // Array of winning trades
```

### Close a Trade
```javascript
const response = await fetch('/api/features/trade-history/close', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tradeId: 'trade_1234567890_abc123',
    exitPrice: 0.075,
    exitAmount: 100,
    sellReason: 'take_profit'
  })
});
const data = await response.json();
console.log(data.data.realizedPnL); // PnL amount
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "message": "Error description",
  "error": "Detailed error message",
  "data": null
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing parameters)
- `404` - Not Found (trade doesn't exist)
- `500` - Internal Server Error

---

## Notes

1. **Authentication**: Most endpoints support both JWT and API Key authentication via `flexibleAuthMiddleware`
2. **User Filtering**: Trade queries are automatically filtered by the authenticated user's ID
3. **Date Formats**: All dates should be in ISO 8601 format (e.g., `2024-11-27T12:00:00Z`)
4. **Pagination**: Use `limit` and `offset` parameters in query endpoints for pagination
5. **Redis Storage**: All trade data is stored in Redis with 90-day TTL
