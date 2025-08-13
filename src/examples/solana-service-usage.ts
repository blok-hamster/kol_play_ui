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
    console.log('🔍 Getting SOL balance...');
    const balance = await SolanaService.getSolBalance(EXAMPLE_WALLET);
    console.log(`💰 SOL Balance: ${balance} SOL`);
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
    console.log('🔍 Getting all SPL tokens...');
    const tokens = await SolanaService.getTokens(EXAMPLE_WALLET);
    console.log(`🪙 Found ${tokens.length} tokens:`);
    
    tokens.forEach((token, index) => {
      console.log(`${index + 1}. ${token.symbol || 'Unknown'} (${token.mintAddress})`);
      console.log(`   Balance: ${token.uiAmount} tokens`);
      console.log(`   Decimals: ${token.decimals}`);
      console.log('');
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
    console.log('🔍 Getting complete wallet balance...');
    const walletBalance = await SolanaService.getWalletBalance(EXAMPLE_WALLET);
    
    console.log('📊 Complete Wallet Balance:');
    console.log(`Address: ${walletBalance.address}`);
    console.log(`SOL Balance: ${walletBalance.solBalance} SOL`);
    console.log(`Total Tokens: ${walletBalance.totalTokens}`);
    console.log('');
    
    if (walletBalance.tokens.length > 0) {
      console.log('🪙 Token Holdings:');
      walletBalance.tokens.forEach((token, index) => {
        console.log(`${index + 1}. ${token.symbol || 'Unknown'}: ${token.uiAmount}`);
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
    console.log('🔍 Getting USDC balance...');
    const tokenBalance = await SolanaService.getSpecificTokenBalance(
      EXAMPLE_WALLET,
      USDC_MINT
    );
    
    if (tokenBalance) {
      console.log('💵 USDC Balance:');
      console.log(`Amount: ${tokenBalance.uiAmount} USDC`);
      console.log(`Mint: ${tokenBalance.mintAddress}`);
      console.log(`Decimals: ${tokenBalance.decimals}`);
    } else {
      console.log('❌ No USDC balance found for this wallet');
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
    console.log('🔍 Testing connection...');
    const isConnected = await SolanaService.testConnection();
    console.log(`🌐 Connection status: ${isConnected ? '✅ Connected' : '❌ Failed'}`);
    
    console.log('🔍 Validating address...');
    const isValid = SolanaService.isValidAddress(EXAMPLE_WALLET);
    console.log(`📝 Address validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    
    console.log('🔍 Current RPC endpoint:');
    console.log(`🌐 RPC URL: ${SolanaService.getRpcEndpoint()}`);
    
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
    console.log('🔧 Setting custom RPC endpoint...');
    
    // Example with a custom RPC (you can replace with your own)
    // SolanaService.setRpcEndpoint('https://your-custom-rpc-url.com', 'confirmed');
    
    // For demo, we'll just show the current endpoint
    console.log(`Current RPC: ${SolanaService.getRpcEndpoint()}`);
    
    // Test the connection
    const isConnected = await SolanaService.testConnection();
    console.log(`Connection test: ${isConnected ? '✅' : '❌'}`);
    
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
  console.log('🚀 Starting Solana Service Examples...\n');
  
  try {
    await testConnectionAndValidation();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await getWalletSolBalance();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await getWalletTokens();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await getCompleteWalletBalance();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await getSpecificTokenBalance();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await setCustomRpcEndpoint();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Example execution failed:', error);
  }
}

// Export individual functions for use in components
export {
  SolanaService
} from '@/services'; 