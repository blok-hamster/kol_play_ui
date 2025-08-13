# Solana Service Documentation

A comprehensive frontend service for interacting with the Solana blockchain to get wallet balances and SPL token information.

## Overview

The `SolanaService` provides a clean, TypeScript-friendly interface for:
- Getting SOL balance for any wallet address
- Retrieving all SPL tokens held by a wallet
- Getting specific token balances
- Validating Solana addresses
- Managing RPC connections

## Features

✅ **Frontend-only** - No backend required  
✅ **TypeScript support** - Full type safety  
✅ **Error handling** - Comprehensive error management  
✅ **Flexible RPC** - Use any Solana RPC endpoint  
✅ **Token metadata** - Automatic token information retrieval  
✅ **Address validation** - Built-in address validation  
✅ **Connection testing** - RPC endpoint health checks  

## Installation

The service uses the following dependencies (already installed in this project):

```bash
npm install @solana/web3.js@^1.98.2 @solana/spl-token
```

## Quick Start

```typescript
import { SolanaService } from '@/services';

// Get SOL balance
const solBalance = await SolanaService.getSolBalance('YOUR_WALLET_ADDRESS');
console.log(`SOL Balance: ${solBalance}`);

// Get all tokens
const tokens = await SolanaService.getTokens('YOUR_WALLET_ADDRESS');
console.log(`Found ${tokens.length} tokens`);

// Get complete wallet info
const walletBalance = await SolanaService.getWalletBalance('YOUR_WALLET_ADDRESS');
console.log(walletBalance);
```

## API Reference

### Core Methods

#### `getSolBalance(address: string): Promise<number>`
Get the SOL balance for a wallet address.

```typescript
const balance = await SolanaService.getSolBalance('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
// Returns: 1.5 (SOL amount)
```

#### `getTokens(address: string): Promise<SolanaTokenInfo[]>`
Get all SPL tokens held by a wallet (excluding zero balances).

```typescript
const tokens = await SolanaService.getTokens('YOUR_WALLET_ADDRESS');
// Returns array of SolanaTokenInfo objects
```

#### `getWalletBalance(address: string): Promise<SolanaWalletBalance>`
Get complete wallet information including SOL and all tokens.

```typescript
const walletBalance = await SolanaService.getWalletBalance('YOUR_WALLET_ADDRESS');
/*
Returns:
{
  address: 'YOUR_WALLET_ADDRESS',
  solBalance: 1.5,
  tokens: [...],
  totalTokens: 10
}
*/
```

#### `getSpecificTokenBalance(walletAddress: string, mintAddress: string): Promise<SolanaTokenInfo | null>`
Get balance for a specific SPL token.

```typescript
const usdcBalance = await SolanaService.getSpecificTokenBalance(
  'YOUR_WALLET_ADDRESS',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC mint
);
```

### Utility Methods

#### `isValidAddress(address: string): boolean`
Validate if a string is a valid Solana address.

```typescript
const isValid = SolanaService.isValidAddress('YOUR_ADDRESS');
// Returns: true or false
```

#### `setRpcEndpoint(rpcUrl: string, commitment?: 'processed' | 'confirmed' | 'finalized'): void`
Set a custom RPC endpoint.

```typescript
SolanaService.setRpcEndpoint('https://api.mainnet-beta.solana.com', 'confirmed');
```

#### `getRpcEndpoint(): string`
Get the current RPC endpoint URL.

```typescript
const currentRpc = SolanaService.getRpcEndpoint();
```

#### `testConnection(): Promise<boolean>`
Test connection to the current RPC endpoint.

```typescript
const isConnected = await SolanaService.testConnection();
```

## Type Definitions

### SolanaTokenInfo
```typescript
interface SolanaTokenInfo {
  mintAddress: string;      // Token mint address
  balance: number;          // Raw balance (with decimals)
  decimals: number;         // Token decimals
  uiAmount: number;         // Human-readable amount
  name?: string;            // Token name (if available)
  symbol?: string;          // Token symbol (if available)
  logoURI?: string;         // Token logo URL (if available)
}
```

### SolanaWalletBalance
```typescript
interface SolanaWalletBalance {
  address: string;          // Wallet address
  solBalance: number;       // SOL balance in SOL units
  tokens: SolanaTokenInfo[]; // Array of token holdings
  totalTokens: number;      // Number of different tokens held
}
```

### SolanaConnectionConfig
```typescript
interface SolanaConnectionConfig {
  rpcUrl?: string;          // Custom RPC URL
  commitment?: 'processed' | 'confirmed' | 'finalized';
}
```

## Usage Examples

### Basic Wallet Balance Check
```typescript
import { SolanaService } from '@/services';

async function checkWalletBalance(address: string) {
  try {
    const walletBalance = await SolanaService.getWalletBalance(address);
    
    console.log(`Wallet: ${walletBalance.address}`);
    console.log(`SOL Balance: ${walletBalance.solBalance} SOL`);
    console.log(`Total Tokens: ${walletBalance.totalTokens}`);
    
    walletBalance.tokens.forEach((token, index) => {
      console.log(`${index + 1}. ${token.symbol || 'Unknown'}: ${token.uiAmount}`);
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
  }
}
```

### React Component Example
```typescript
import React, { useState, useEffect } from 'react';
import { SolanaService, SolanaWalletBalance } from '@/services';

export function WalletBalanceComponent({ address }: { address: string }) {
  const [balance, setBalance] = useState<SolanaWalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      try {
        setLoading(true);
        setError(null);
        
        if (!SolanaService.isValidAddress(address)) {
          throw new Error('Invalid Solana address');
        }
        
        const walletBalance = await SolanaService.getWalletBalance(address);
        setBalance(walletBalance);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (address) {
      fetchBalance();
    }
  }, [address]);

  if (loading) return <div>Loading wallet balance...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!balance) return <div>No balance data</div>;

  return (
    <div>
      <h3>Wallet Balance</h3>
      <p>Address: {balance.address}</p>
      <p>SOL Balance: {balance.solBalance} SOL</p>
      <p>Total Tokens: {balance.totalTokens}</p>
      
      {balance.tokens.length > 0 && (
        <div>
          <h4>Token Holdings:</h4>
          <ul>
            {balance.tokens.map((token, index) => (
              <li key={token.mintAddress}>
                {token.symbol || 'Unknown'}: {token.uiAmount}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### Custom RPC Configuration
```typescript
// Set up custom RPC endpoint (e.g., QuickNode, Alchemy, etc.)
SolanaService.setRpcEndpoint('https://your-custom-rpc-endpoint.com', 'confirmed');

// Test the connection
const isConnected = await SolanaService.testConnection();
if (isConnected) {
  console.log('✅ Connected to custom RPC');
} else {
  console.log('❌ Failed to connect to RPC');
}
```

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  const balance = await SolanaService.getSolBalance('invalid-address');
} catch (error) {
  if (error.message.includes('Invalid public key')) {
    console.log('Invalid address format');
  } else if (error.message.includes('Failed to fetch')) {
    console.log('Network or RPC error');
  } else {
    console.log('Unknown error:', error.message);
  }
}
```

## Performance Considerations

1. **RPC Rate Limits**: Be mindful of RPC endpoint rate limits
2. **Parallel Requests**: The service uses `Promise.all()` for efficient parallel requests
3. **Caching**: Consider implementing client-side caching for frequently accessed data
4. **Custom RPC**: Use a dedicated RPC endpoint for production applications

## Recommended RPC Providers

- **Free**: Solana's public endpoints (rate limited)
- **Paid**: QuickNode, Alchemy, Helius, GenesysGo
- **Self-hosted**: Run your own Solana validator

## Troubleshooting

### Common Issues

1. **"Invalid public key" error**
   - Ensure the address is a valid Solana address
   - Use `SolanaService.isValidAddress()` to validate

2. **Network timeouts**
   - Check RPC endpoint status
   - Try a different RPC provider
   - Use `SolanaService.testConnection()` to diagnose

3. **No tokens returned**
   - Wallet may have no SPL tokens
   - All token balances might be zero (filtered out)
   - Check if wallet address is correct

4. **Metadata not loading**
   - Token metadata is optional and may not be available
   - Some tokens don't have metadata programs

### Debug Mode

Enable debug logging by checking browser console for detailed error messages.

## Contributing

To extend the service:

1. Add new methods to `SolanaService` class
2. Update type definitions in `src/types/index.ts`
3. Add examples to `src/examples/solana-service-usage.ts`
4. Update this documentation

## License

This service is part of the KOL Play UI project and follows the same license terms. 