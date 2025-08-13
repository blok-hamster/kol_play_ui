import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely format a number with toFixed, handling null, undefined, and NaN values
 */
export function safeToFixed(
  value: number | undefined | null, 
  decimals: number = 2, 
  fallback: string = '0'
): string {
  if (value == null || typeof value !== 'number' || isNaN(value)) {
    return fallback;
  }
  return value.toFixed(decimals);
}

/**
 * Safely format an amount with abbreviations (K, M, B), handling null/undefined values
 */
export function safeFormatAmount(
  amount: number | undefined | null,
  decimals: number = 6,
  fallback: string = '0.000000'
): string {
  if (amount == null || typeof amount !== 'number' || isNaN(amount)) {
    return fallback;
  }
  
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
  return amount.toFixed(decimals);
}

/**
 * Format currency values safely
 */
export function formatCurrency(
  amount: number | undefined | null,
  currency: string = 'USD',
  decimals: number = 2
): string {
  // Handle null, undefined, or non-numeric values
  if (amount == null || typeof amount !== 'number' || isNaN(amount)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(0);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format numbers with abbreviations (K, M, B)
 */
export function formatNumber(num: number, decimals?: number): string {
  if (decimals !== undefined) {
    return num.toFixed(decimals);
  }

  if (num >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Format wallet address for display
 */
export function formatWalletAddress(
  address: string | undefined | null,
  startChars: number = 4,
  endChars: number = 4
): string {
  if (!address || typeof address !== 'string') {
    return 'Unknown Address';
  }
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format a timestamp to show relative time (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(timestamp: number | Date): string {
  const now = Date.now();
  const timestampMs =
    timestamp instanceof Date ? timestamp.getTime() : timestamp * 1000;
  const diffMs = now - timestampMs;

  // If timestamp is in the future, show "just now"
  if (diffMs < 0) {
    return 'just now';
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return diffSeconds <= 1 ? 'just now' : `${diffSeconds}s ago`;
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 min ago' : `${diffMinutes} mins ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else if (diffWeeks < 4) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
}

/**
 * Format a number as a percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
