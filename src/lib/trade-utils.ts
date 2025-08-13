import { UpdateSettingParams } from '@/services/settings.service';
import { SettingsService } from '@/services/settings.service';
import { SwapService } from '@/services/swap.service';
import { SwapData } from '@/types';

/**
 * Check if user has valid trade configuration
 */
export async function checkTradeConfig(): Promise<{
  hasConfig: boolean;
  config?: UpdateSettingParams;
  error?: string;
}> {
  try {
    const response = await SettingsService.getUserSettings();
    const settings = response.data;

    // Check if trade config exists and has required fields
    if (
      settings?.tradeConfig &&
      typeof settings.tradeConfig.minSpend === 'number' &&
      typeof settings.tradeConfig.maxSpend === 'number' &&
      settings.tradeConfig.minSpend > 0 &&
      settings.tradeConfig.maxSpend > 0 &&
      settings.tradeConfig.minSpend <= settings.tradeConfig.maxSpend
    ) {
      return {
        hasConfig: true,
        config: settings,
      };
    }

    return {
      hasConfig: false,
      error: 'Trade configuration is incomplete or invalid',
    };
  } catch (error: any) {
    return {
      hasConfig: false,
      error: error.message || 'Failed to fetch trade configuration',
    };
  }
}

/**
 * Execute instant buy with user's saved trade config
 */
export async function executeInstantBuy(
  tokenMint: string,
  tokenSymbol?: string
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  try {
    // First check if user has valid trade config
    const configCheck = await checkTradeConfig();
    
    if (!configCheck.hasConfig) {
      return {
        success: false,
        error: configCheck.error || 'No trade configuration found',
      };
    }

    const settings = configCheck.config!;
    const tradeConfig = settings.tradeConfig;

    // Use minimum spend amount for instant buy
    const buyAmount = tradeConfig.minSpend!;

    // Prepare swap data
    const swapData: SwapData = {
      tradeType: 'buy',
      amount: buyAmount,
      mint: tokenMint,
      // Include watch config if enabled
      ...(tradeConfig.useWatchConfig && settings.watchConfig && {
        watchConfig: {
          takeProfitPercentage: settings.watchConfig.takeProfitPercentage || 20,
          stopLossPercentage: settings.watchConfig.stopLossPercentage || 10,
          enableTrailingStop: settings.watchConfig.enableTrailingStop || false,
          trailingPercentage: settings.watchConfig.trailingPercentage || 5,
          maxHoldTimeMinutes: settings.watchConfig.maxHoldTimeMinutes || 60,
        },
      }),
    };

    // Execute the swap
    const response = await SwapService.performSwap(swapData);

    return {
      success: true,
      result: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to execute instant buy',
    };
  }
}

/**
 * Execute instant sell of all tokens with the given mint address
 */
export async function executeInstantSell(
  tokenMint: string,
  tokenSymbol?: string,
  tokenBalance?: number
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  try {
    // First check if user has valid trade config
    const configCheck = await checkTradeConfig();
    
    if (!configCheck.hasConfig) {
      return {
        success: false,
        error: configCheck.error || 'No trade configuration found',
      };
    }

    const settings = configCheck.config!;
    const tradeConfig = settings.tradeConfig;

    // For sell orders, we need to specify the token amount to sell
    // If tokenBalance is provided, use it; otherwise the backend should handle getting the balance
    const sellAmount = tokenBalance || 0; // Backend will determine actual balance if 0

    // Prepare swap data for sell
    const swapData: SwapData = {
      tradeType: 'sell',
      amount: sellAmount,
      mint: tokenMint,
      // Include watch config if enabled (though less relevant for instant sells)
      ...(tradeConfig.useWatchConfig && settings.watchConfig && {
        watchConfig: {
          takeProfitPercentage: settings.watchConfig.takeProfitPercentage || 20,
          stopLossPercentage: settings.watchConfig.stopLossPercentage || 10,
          enableTrailingStop: settings.watchConfig.enableTrailingStop || false,
          trailingPercentage: settings.watchConfig.trailingPercentage || 5,
          maxHoldTimeMinutes: settings.watchConfig.maxHoldTimeMinutes || 60,
        },
      }),
    };

    // Execute the swap
    const response = await SwapService.performSwap(swapData);

    return {
      success: true,
      result: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to execute instant sell',
    };
  }
}

/**
 * Get trade settings summary for display
 */
export function getTradeConfigSummary(config?: UpdateSettingParams): string {
  if (!config?.tradeConfig) {
    return 'No trade configuration';
  }

  const { minSpend, maxSpend, slippage } = config.tradeConfig;
  return `${minSpend} - ${maxSpend} SOL, ${slippage || 0.5}% slippage`;
} 