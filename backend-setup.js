// Minimal Backend Server for KOL Trades
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Sample data
const sampleTrades = [];
const sampleMindmapData = {};
const sampleStats = {
  totalTrades: 0,
  uniqueKOLs: 0,
  uniqueTokens: 0,
  totalVolume: 0
};

// API Endpoints
app.get('/api/kol-trades/recent', (req, res) => {
  res.json({
    success: true,
    data: {
      trades: sampleTrades.slice(0, req.query.limit || 50)
    }
  });
});

app.get('/api/kol-trades/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      tradingStats: sampleStats
    }
  });
});

app.get('/api/kol-trades/trending-tokens', (req, res) => {
  res.json({
    success: true,
    data: {
      trendingTokens: []
    }
  });
});

app.get('/api/kol-trades/mindmap/:tokenMint', (req, res) => {
  res.json({
    success: true,
    data: {
      mindmap: sampleMindmapData[req.params.tokenMint] || null
    }
  });
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('subscribe_kol_trades', () => {
    console.log('Client subscribed to KOL trades');
    socket.join('kol_trades');
  });
  
  socket.on('subscribe_mindmap', (data) => {
    console.log('Client subscribed to mindmap:', data.tokenMint);
    socket.join(`mindmap_${data.tokenMint}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Simulate real-time data (for testing)
setInterval(() => {
  if (Math.random() > 0.7) { // 30% chance
    const mockTrade = {
      id: `trade_${Date.now()}`,
      kolWallet: `${Math.random().toString(36).substr(2, 8)}...${Math.random().toString(36).substr(2, 4)}`,
      signature: `sig_${Date.now()}`,
      timestamp: new Date(),
      tradeData: {
        tokenIn: 'SOL',
        tokenOut: `TOKEN_${Math.floor(Math.random() * 1000)}`,
        amountIn: Math.random() * 10,
        amountOut: Math.random() * 1000,
        tradeType: Math.random() > 0.5 ? 'buy' : 'sell',
        source: 'Jupiter',
        fee: Math.random() * 0.1
      },
      affectedUsers: [],
      processed: true,
      mindmapContribution: {
        tokenConnections: [],
        kolInfluenceScore: Math.floor(Math.random() * 100),
        relatedTrades: []
      }
    };
    
    sampleTrades.unshift(mockTrade);
    if (sampleTrades.length > 100) sampleTrades.pop();
    
    // Update stats
    sampleStats.totalTrades = sampleTrades.length;
    sampleStats.uniqueKOLs = new Set(sampleTrades.map(t => t.kolWallet)).size;
    sampleStats.totalVolume += mockTrade.tradeData.amountIn;
    
    // Emit to connected clients
    io.to('kol_trades').emit('kol_trade_update', mockTrade);
    console.log('Emitted mock trade:', mockTrade.id);
  }
}, 5000); // Every 5 seconds

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 KOL Trades Server running on port ${PORT}`);
  console.log(`📊 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🔗 API endpoint: http://localhost:${PORT}/api`);
}); 