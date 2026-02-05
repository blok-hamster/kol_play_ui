import { SolanaService } from './solana.service';
import { PortfolioService } from './portfolio.service';
import useTradingStore from '@/stores/use-trading-store';

export interface ValidationResult {
    isValid: boolean;
    message?: string;
}

export class BalanceService {
    private static readonly GAS_BUFFER = 0.005; // SOL buffer for rent/txs
    private static readonly PAPER_GAS_BUFFER = 0.000005; // Mock fee for paper trading

    /**
     * Get SOL balance for a specific wallet
     */
    static async getSolBalance(address: string, isPaperMode: boolean = false): Promise<number> {
        if (isPaperMode) {
            const paperData = await PortfolioService.getPaperBalance();
            return paperData.data?.['SOL'] || 0;
        }
        return await SolanaService.getSolBalance(address);
    }

    /**
     * Get Token balance for a specific wallet and mint
     */
    static async getTokenBalance(address: string, mint: string, isPaperMode: boolean = false): Promise<number> {
        if (isPaperMode) {
            const paperData = await PortfolioService.getPaperBalance();
            return paperData.data?.[mint] || 0;
        }
        const tokenInfo = await SolanaService.getSpecificTokenBalance(address, mint);
        return tokenInfo ? tokenInfo.uiAmount : 0;
    }

    /**
     * Validate if a swap can proceed based on user balances
     * @param address User wallet address
     * @param inputMint Mint of the token being sold (or "SOL" if buying)
     * @param amount Amount to swap
     * @param isBuy Whether the user is buying the target token (implies paying with SOL)
     * @param priorityFee Priority fee in SOL
     */
    static async validateSwap(
        address: string,
        inputMint: string, // If buying, this is usually SOL (So111...) or ignored if we rely on isBuy
        amount: number,
        isBuy: boolean,
        priorityFee: number = 0.003
    ): Promise<ValidationResult> {
        if (!address) {
            return { isValid: false, message: 'Wallet not connected' };
        }

        if (amount <= 0) {
            return { isValid: false, message: 'Amount must be greater than 0' };
        }

        const isPaperMode = useTradingStore.getState().isPaperTrading;
        const gasBuffer = isPaperMode ? this.PAPER_GAS_BUFFER : this.GAS_BUFFER;

        try {
            if (isBuy) {
                // User is Buying Target Token using SOL
                // Check SOL Balance >= Amount + PriorityFee + GasBuffer
                const solBalance = await this.getSolBalance(address, isPaperMode);
                const totalRequired = amount + (isPaperMode ? 0 : priorityFee) + gasBuffer;

                if (solBalance < totalRequired) {
                    return {
                        isValid: false,
                        message: `Insufficient ${isPaperMode ? 'Paper ' : ''}SOL. Have ${solBalance.toFixed(isPaperMode ? 6 : 4)}, need ${totalRequired.toFixed(isPaperMode ? 6 : 4)}`
                    };
                }
            } else {
                // User is Selling Target Token (inputMint)
                // Check Token Balance >= Amount
                // Also check if user has enough SOL for fees
                const [tokenBalance, solBalance] = await Promise.all([
                    this.getTokenBalance(address, inputMint, isPaperMode),
                    this.getSolBalance(address, isPaperMode)
                ]);

                if (tokenBalance < amount) {
                    return {
                        isValid: false,
                        message: `Insufficient ${isPaperMode ? 'Paper ' : ''}Balance. Have ${tokenBalance}, trying to sell ${amount}`
                    };
                }

                const requiredSolForFee = isPaperMode ? gasBuffer : (priorityFee + gasBuffer / 2);
                if (solBalance < requiredSolForFee) {
                    return {
                        isValid: false,
                        message: `Insufficient ${isPaperMode ? 'Paper ' : ''}SOL for fees. Have ${solBalance.toFixed(isPaperMode ? 6 : 4)}`
                    };
                }
            }

            return { isValid: true };
        } catch (error) {
            console.error('Balance validation failed:', error);
            return { isValid: false, message: 'Failed to validate balance' };
        }
    }
}
