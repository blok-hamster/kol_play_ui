import axios, { AxiosError } from 'axios';
import { API_ENDPOINTS } from '@/lib/constants';

export interface TransferSolRequest {
  to: string;
  amount: number;
}

export interface TransferTokenRequest {
  to: string;
  amount: number;
  mint: string;
}

export interface TransferResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
}

class TransferService {
  private async makeRequest<T>(
    endpoint: string,
    data: T
  ): Promise<TransferResponse> {
    try {
      const response = await axios.post(`${API_ENDPOINTS.BASE_URL}${endpoint}`, data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      return {
        success: true,
        transactionId: response.data.transactionId,
      };
    } catch (error: any) {
      console.error('Transfer request failed:', error);
      
      let errorMessage = 'Transfer failed';
      
      if (error instanceof AxiosError) {
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.statusText) {
          errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
        } else if (error.message) {
          errorMessage = error.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async transferSol(request: TransferSolRequest): Promise<TransferResponse> {
    // Validate request
    if (!request.to || !request.to.trim()) {
      return {
        success: false,
        error: 'Recipient address is required',
      };
    }

    if (!request.amount || request.amount <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      };
    }

    // Basic Solana address validation (32-44 characters, base58)
    const trimmedAddress = request.to.trim();
    if (trimmedAddress.length < 32 || trimmedAddress.length > 44) {
      return {
        success: false,
        error: 'Invalid Solana address format',
      };
    }

    // Check for valid base58 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(trimmedAddress)) {
      return {
        success: false,
        error: 'Invalid Solana address characters',
      };
    }

    return this.makeRequest(API_ENDPOINTS.FEATURES.TRANSFER_SOL, {
      ...request,
      to: trimmedAddress,
    });
  }

  async transferToken(request: TransferTokenRequest): Promise<TransferResponse> {
    // Validate request
    if (!request.to || !request.to.trim()) {
      return {
        success: false,
        error: 'Recipient address is required',
      };
    }

    if (!request.amount || request.amount <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      };
    }

    if (!request.mint || !request.mint.trim()) {
      return {
        success: false,
        error: 'Token mint address is required',
      };
    }

    const trimmedRecipient = request.to.trim();
    const trimmedMint = request.mint.trim();

    // Basic Solana address validation for recipient
    if (trimmedRecipient.length < 32 || trimmedRecipient.length > 44) {
      return {
        success: false,
        error: 'Invalid recipient address format',
      };
    }

    // Basic Solana address validation for mint
    if (trimmedMint.length < 32 || trimmedMint.length > 44) {
      return {
        success: false,
        error: 'Invalid token mint address format',
      };
    }

    // Check for valid base58 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(trimmedRecipient)) {
      return {
        success: false,
        error: 'Invalid recipient address characters',
      };
    }

    if (!base58Regex.test(trimmedMint)) {
      return {
        success: false,
        error: 'Invalid token mint address characters',
      };
    }

    return this.makeRequest(API_ENDPOINTS.FEATURES.TRANSFER_TOKEN, {
      ...request,
      to: trimmedRecipient,
      mint: trimmedMint,
    });
  }
}

export const transferService = new TransferService();