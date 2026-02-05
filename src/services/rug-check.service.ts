import apiClient from '@/lib/api';
import { ApiResponse } from '@/types';

export interface RugCheckSecurityData {
  mint: string;
  score: number;
  status: 'good' | 'warning' | 'danger';
  risks: Array<{
    name: string;
    description: string;
    level: 'low' | 'medium' | 'high';
  }>;
  distribution: {
    top10HoldersPercentage: number;
    devHoldingPercentage: number;
    snipersCount: number;
    insidersPercentage: number;
    bundlesPercentage: number;
    freshBuysCount: number;
    freshHoldingsPercentage: number;
  };
  authorities: {
    mintAuthDisabled: boolean;
    freezeAuthDisabled: boolean;
    ownerBalance?: number;
  };
  markets: Array<{
    pubkey: string;
    marketType: string;
    liquidityUsd: number;
    isLocked: boolean;
    lpBurnedPercentage: number;
  }>;
}

// Type alias for backward compatibility
export type RugCheckResult = {
  score: number;
  risks: Array<{ name: string; description: string; level: string }>;
  liquidity?: number;
  mintAuthority: boolean;
  freezeAuthority: boolean;
};


export class RugCheckService {
  /**
   * Fetch security analysis for a specific token mint directly from RugCheck skiping backend
   */
  static async getTokenSecurity(mint: string): Promise<ApiResponse<RugCheckSecurityData>> {
    try {
      const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`RugCheck API error (${response.status}):`, errorText);
        throw new Error(`RugCheck API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform RugCheck raw data to our internal format
      const transformedData = this.transformSecurityData(data);
      
      return {
        success: true,
        message: 'Security report fetched successfully from RugCheck',
        data: transformedData
      } as any;
    } catch (error: any) {
      console.error('Error fetching RugCheck report:', error);
      throw error;
    }
  }

  /**
   * Alias for getTokenSecurity - for backward compatibility
   * Returns data in RugCheckResult format
   */
  static async checkToken(mint: string): Promise<RugCheckResult> {
    // Validate mint address format (Solana addresses are typically 32-44 characters)
    if (!mint || mint.length < 32) {
      throw new Error('Invalid token address. Please enter a valid Solana mint address (not a symbol).');
    }

    try {
      const response = await this.getTokenSecurity(mint);
      const data = response.data;
      
      return {
        score: Math.max(0, 100 - (data.score / 30)), // Invert score: lower RugCheck score = higher safety
        risks: data.risks.map(r => ({
          name: r.name,
          description: r.description,
          level: r.level
        })),
        liquidity: data.markets[0]?.liquidityUsd,
        mintAuthority: !data.authorities.mintAuthDisabled,
        freezeAuthority: !data.authorities.freezeAuthDisabled
      };
    } catch (error: any) {
      // Provide more helpful error messages
      if (error.message?.includes('400')) {
        throw new Error('Token not found in RugCheck database. This token may be too new, unlisted, or not yet indexed.');
      }
      if (error.message?.includes('404')) {
        throw new Error('Token not found. Please verify the mint address is correct.');
      }
      throw error;
    }
  }


  /**
   * Fetch liquidity and market details for a token
   */
  static async getLiquidityInfo(mint: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/api/features/token-liquidity/${mint}`);
  }

  /**
   * Helper to determine risk level color
   */
  static getRiskColor(level: string): string {
    switch (level.toLowerCase()) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  }

  /**
   * Transform RugCheck raw data into our internal SecurityData format
   */
  static transformSecurityData(raw: any): RugCheckSecurityData {
    // Map risk levels from RugCheck to our internal status
    const score = raw.score || 0;
    let status: 'good' | 'warning' | 'danger' = 'good';
    
    if (score > 2000) status = 'danger';
    else if (score > 500) status = 'warning';

    return {
      mint: raw.mint,
      score: score,
      status: status,
      risks: (raw.risks || []).map((risk: any) => ({
        name: risk.name,
        description: risk.description,
        level: risk.level === 'danger' ? 'high' : (risk.level === 'warning' ? 'medium' : 'low')
      })),
      distribution: {
        top10HoldersPercentage: raw.topHolders?.slice(0, 10).reduce((acc: number, h: any) => acc + (h.pct || 0), 0) || 0,
        devHoldingPercentage: raw.topHolders?.find((h: any) => h.address === raw.creator)?.pct || 0,
        snipersCount: raw.risks?.filter((r: any) => r.name.toLowerCase().includes('sniper')).length || 0,
        insidersPercentage: raw.topHolders?.filter((h: any) => h.insider).reduce((acc: number, h: any) => acc + (h.pct || 0), 0) || 0,
        bundlesPercentage: 0, // RugCheck doesn't provide this directly in a simple field
        freshBuysCount: 0,
        freshHoldingsPercentage: 0
      },
      authorities: {
        mintAuthDisabled: raw.token?.mintAuthority === null,
        freezeAuthDisabled: raw.token?.freezeAuthority === null,
        ownerBalance: raw.topHolders?.find((h: any) => h.address === raw.creator)?.amount || 0
      },
      markets: (raw.markets || []).map((m: any) => ({
        pubkey: m.pubkey,
        marketType: m.marketType,
        liquidityUsd: m.lp?.reserveUSD || 0,
        isLocked: m.lp?.pct === 100, // Simplification: if 100% of LP is in this market
        lpBurnedPercentage: m.lp?.pct || 0
      }))
    };
  }
}
