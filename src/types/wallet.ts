// Phantom wallet types
export interface PhantomProvider {
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

// Extend the global Window interface
declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
  }
}
