import { WalletInfo } from '@/types';

// Phantom wallet types
interface PhantomProvider {
  isPhantom: boolean;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
  connect(options?: {
    onlyIfTrusted?: boolean;
  }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  on(event: string, callback: () => void): void;
  removeListener(event: string, callback: () => void): void;
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
  }
}

export class WalletService {
  private static provider: PhantomProvider | null = null;
  private static listeners: Map<string, (() => void)[]> = new Map();

  /**
   * Initialize Phantom wallet provider
   */
  static async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (window.phantom?.solana?.isPhantom) {
      this.provider = window.phantom.solana;
      this.setupEventListeners();
    } else {
      throw new Error(
        'Phantom wallet not found. Please install Phantom wallet extension.'
      );
    }
  }

  /**
   * Check if Phantom wallet is installed
   */
  static isPhantomInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    return !!window.phantom?.solana?.isPhantom;
  }

  /**
   * Connect to Phantom wallet
   */
  static async connect(onlyIfTrusted = false): Promise<WalletInfo> {
    try {
      if (!this.provider) {
        await this.initialize();
      }

      if (!this.provider) {
        throw new Error('Phantom wallet not available');
      }

      const response = await this.provider.connect({ onlyIfTrusted });

      if (!response.publicKey) {
        throw new Error('Failed to connect to wallet');
      }

      const walletInfo: WalletInfo = {
        address: response.publicKey.toString(),
        balance: 0, // Will be fetched separately
        isConnected: true,
      };

      // Fetch SOL balance
      try {
        const balance = await this.getBalance(walletInfo.address);
        walletInfo.balance = balance;
      } catch (error) {
        console.warn('Failed to fetch wallet balance:', error);
      }

      return walletInfo;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the connection request');
      }
      throw new Error(error.message || 'Failed to connect to Phantom wallet');
    }
  }

  /**
   * Disconnect from Phantom wallet
   */
  static async disconnect(): Promise<void> {
    try {
      if (this.provider) {
        await this.provider.disconnect();
      }
    } catch (error: any) {
      console.warn('Error disconnecting wallet:', error);
    }
  }

  /**
   * Check if wallet is currently connected
   */
  static isConnected(): boolean {
    return this.provider?.isConnected || false;
  }

  /**
   * Get current wallet address
   */
  static getAddress(): string | null {
    return this.provider?.publicKey?.toString() || null;
  }

  /**
   * Get wallet balance (SOL)
   */
  static async getBalance(address?: string): Promise<number> {
    try {
      const walletAddress = address || this.getAddress();
      if (!walletAddress) {
        throw new Error('No wallet address available');
      }

      // For now, return 0 - we'll implement RPC calls later when needed
      // In practice, you would make an RPC call to Solana to get the balance
      return 0;
    } catch (error: any) {
      console.error('Failed to get wallet balance:', error);
      return 0;
    }
  }

  /**
   * Get current wallet info
   */
  static async getWalletInfo(): Promise<WalletInfo | null> {
    try {
      if (!this.isConnected()) {
        return null;
      }

      const address = this.getAddress();
      if (!address) {
        return null;
      }

      const balance = await this.getBalance(address);

      return {
        address,
        balance,
        isConnected: true,
      };
    } catch (error: any) {
      console.error('Failed to get wallet info:', error);
      return null;
    }
  }

  /**
   * Set up event listeners for wallet events
   */
  private static setupEventListeners(): void {
    if (!this.provider) return;

    const handleConnect = () => {
      this.notifyListeners('connect');
    };

    const handleDisconnect = () => {
      this.notifyListeners('disconnect');
    };

    const handleAccountChanged = () => {
      this.notifyListeners('accountChanged');
    };

    this.provider.on('connect', handleConnect);
    this.provider.on('disconnect', handleDisconnect);
    this.provider.on('accountChanged', handleAccountChanged);
  }

  /**
   * Add event listener
   */
  static addEventListener(
    event: 'connect' | 'disconnect' | 'accountChanged',
    callback: () => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  static removeEventListener(
    event: 'connect' | 'disconnect' | 'accountChanged',
    callback: () => void
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify all listeners for an event
   */
  private static notifyListeners(event: string): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback());
    }
  }

  /**
   * Auto-connect to wallet if previously connected
   */
  static async autoConnect(): Promise<WalletInfo | null> {
    try {
      if (!this.isPhantomInstalled()) {
        return null;
      }

      await this.initialize();

      // Try to connect only if previously trusted
      const walletInfo = await this.connect(true);
      return walletInfo;
    } catch (error) {
      // Silent fail for auto-connect
      return null;
    }
  }

  /**
   * Open Phantom wallet installation page
   */
  static openInstallPage(): void {
    window.open('https://phantom.app/', '_blank');
  }
}

export default WalletService;
