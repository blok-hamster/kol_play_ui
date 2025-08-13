import { SolanaService } from '@/services';

/**
 * Example usage of SolanaService
 * This file demonstrates how to use the SolanaService to get wallet balances and token information
 */

// Example wallet addresses for testing
const EXAMPLE_WALLET = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'; // Phantom Team wallet
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC token mint

/**
 * Example 1: Get SOL balance for a wallet
 */
export async function getWalletSolBalance() {
  try {
    void 0 && ('🔍 Getting SOL balance...');
    const balance = await SolanaService.getSolBalance(EXAMPLE_WALLET);
    void 0 && (`💰 SOL Balance: ${balance} SOL`);
    return balance;
  } catch (error) {
    console.error('❌ Error getting SOL balance:', error);
    throw error;
  }
}

/**
 * Example 2: Get all SPL tokens held by a wallet
 */
export async function getWalletTokens() {
  try {
    void 0 && ('🔍 Getting all SPL tokens...');
    const tokens = await SolanaService.getTokens(EXAMPLE_WALLET);
    void 0 && (`🪙 Found ${tokens.length} tokens:`);
    
    tokens.forEach((token, index) => {
      void 0 && (`${index + 1}. ${token.symbol || 'Unknown'} (${token.mintAddress})`);
      void 0 && (`   Balance: ${token.uiAmount} tokens`);
      void 0 && (`   Decimals: ${token.decimals}`);
      void 0 && ('');
    });
    
    return tokens;
  } catch (error) {
    console.error('❌ Error getting tokens:', error);
    throw error;
  }
}

/**
 * Example 3: Get complete wallet balance (SOL + all tokens)
 */
export async function getCompleteWalletBalance() {
  try {
    void 0 && ('🔍 Getting complete wallet balance...');
    const walletBalance = await SolanaService.getWalletBalance(EXAMPLE_WALLET);
    
    void 0 && ('📊 Complete Wallet Balance:');
    void 0 && (`Address: ${walletBalance.address}`);
    void 0 && (`SOL Balance: ${walletBalance.solBalance} SOL`);
    void 0 && (`Total Tokens: ${walletBalance.totalTokens}`);
    void 0 && ('');
    
    if (walletBalance.tokens.length > 0) {
      void 0 && ('🪙 Token Holdings:');
      walletBalance.tokens.forEach((token, index) => {
        void 0 && (`${index + 1}. ${token.symbol || 'Unknown'}: ${token.uiAmount}`);
      });
    }
    
    return walletBalance;
  } catch (error) {
    console.error('❌ Error getting complete wallet balance:', error);
    throw error;
  }
}

/**
 * Example 4: Get balance for a specific token
 */
export async function getSpecificTokenBalance() {
  try {
    void 0 && ('🔍 Getting USDC balance...');
    const tokenBalance = await SolanaService.getSpecificTokenBalance(
      EXAMPLE_WALLET,
      USDC_MINT
    );
    
    if (tokenBalance) {
      void 0 && ('💵 USDC Balance:');
      void 0 && (`Amount: ${tokenBalance.uiAmount} USDC`);
      void 0 && (`Mint: ${tokenBalance.mintAddress}`);
      void 0 && (`Decimals: ${tokenBalance.decimals}`);
    } else {
      void 0 && ('❌ No USDC balance found for this wallet');
    }
    
    return tokenBalance;
  } catch (error) {
    console.error('❌ Error getting specific token balance:', error);
    throw error;
  }
}

/**
 * Example 5: Test connection and validate address
 */
export async function testConnectionAndValidation() {
  try {
    void 0 && ('🔍 Testing connection...');
    const isConnected = await SolanaService.testConnection();
    void 0 && (`🌐 Connection status: ${isConnected ? '✅ Connected' : '❌ Failed'}`);
    
    void 0 && ('🔍 Validating address...');
    const isValid = SolanaService.isValidAddress(EXAMPLE_WALLET);
    void 0 && (`📝 Address validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    
    void 0 && ('🔍 Current RPC endpoint:');
    void 0 && (`🌐 RPC URL: ${SolanaService.getRpcEndpoint()}`);
    
    return { isConnected, isValid };
  } catch (error) {
    console.error('❌ Error in connection/validation test:', error);
    throw error;
  }
}

/**
 * Example 6: Using custom RPC endpoint
 */
export async function setCustomRpcEndpoint() {
  try {
    void 0 && ('🔧 Setting custom RPC endpoint...');
    
    // Example with a custom RPC (you can replace with your own)
    // SolanaService.setRpcEndpoint('https://your-custom-rpc-url.com', 'confirmed');
    
    // For demo, we'll just show the current endpoint
    void 0 && (`Current RPC: ${SolanaService.getRpcEndpoint()}`);
    
    // Test the connection
    const isConnected = await SolanaService.testConnection();
    void 0 && (`Connection test: ${isConnected ? '✅' : '❌'}`);
    
    return isConnected;
  } catch (error) {
    console.error('❌ Error setting custom RPC:', error);
    throw error;
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  void 0 && ('🚀 Starting Solana Service Examples...\n');
  
  try {
    await testConnectionAndValidation();
    void 0 && ('\n' + '='.repeat(50) + '\n');
    
    await getWalletSolBalance();
    void 0 && ('\n' + '='.repeat(50) + '\n');
    
    await getWalletTokens();
    void 0 && ('\n' + '='.repeat(50) + '\n');
    
    await getCompleteWalletBalance();
    void 0 && ('\n' + '='.repeat(50) + '\n');
    
    await getSpecificTokenBalance();
    void 0 && ('\n' + '='.repeat(50) + '\n');
    
    await setCustomRpcEndpoint();
    
    void 0 && ('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Example execution failed:', error);
  }
}

// Export individual functions for use in components
export {
  SolanaService
} from '@/services'; 