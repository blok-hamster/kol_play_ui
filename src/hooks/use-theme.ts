'use client';

import { useThemeContext } from '@/components/providers/theme-provider';

/**
 * Hook to access theme state and controls
 * Now uses ThemeProvider context for better SSR support
 */
export const useTheme = () => {
  try {
    return useThemeContext();
  } catch (error) {
    // Fallback for cases where provider might not be available
    console.warn('useTheme called outside of ThemeProvider, using fallback');
    return {
      theme: 'system' as const,
      resolvedTheme: 'light' as const,
      setTheme: () => {
        console.warn('setTheme called outside of ThemeProvider');
      },
    };
  }
};
