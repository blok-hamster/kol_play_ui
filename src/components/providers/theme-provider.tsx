'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'dark',
  storageKey = STORAGE_KEYS.THEME,
}) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  // Get initial theme from localStorage or default
  useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey) as Theme;
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setThemeState(savedTheme);
    }
    setMounted(true);
  }, [storageKey]);

  // Update resolved theme based on current theme and system preference
  useEffect(() => {
    const updateResolvedTheme = () => {
      let resolved: 'light' | 'dark';

      if (theme === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      } else {
        resolved = theme;
      }

      setResolvedTheme(resolved);

      // Apply theme to document
      const root = document.documentElement;
      const isDark = resolved === 'dark';

      // Toggle dark class
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Set CSS custom properties for additional theme variables
      if (isDark) {
        root.style.setProperty('--theme-background', '#171616');
        root.style.setProperty('--theme-foreground', '#f5f5f5');
        root.style.setProperty('--theme-muted', '#2a2a2a');
      } else {
        root.style.setProperty('--theme-background', '#ffffff');
        root.style.setProperty('--theme-foreground', '#1a1a1a');
        root.style.setProperty('--theme-muted', '#f8f9fa');
      }

      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#171616' : '#ffffff');
      }
    };

    if (mounted) {
      updateResolvedTheme();
    }
  }, [theme, mounted]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system' || !mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  // Set theme function
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (mounted) {
      localStorage.setItem(storageKey, newTheme);

      // Dispatch custom event for theme change
      window.dispatchEvent(
        new CustomEvent('theme-change', {
          detail: { theme: newTheme },
        })
      );
    }
  };

  const contextValue: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
  };

  // Always provide the context, even before mounting
  return (
    <ThemeContext.Provider value={contextValue}>
      <div className={resolvedTheme}>
        {!mounted ? (
          <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </ThemeContext.Provider>
  );
};

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

// Script to prevent flash of wrong theme on initial load
export const ThemeScript = () => {
  const script = `
    (function() {
      try {
        const theme = localStorage.getItem('${STORAGE_KEYS.THEME}') || 'dark';
        const isDark = theme === 'dark' || 
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        // Set meta theme-color immediately
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', isDark ? '#171616' : '#ffffff');
        }
      } catch (e) {
        console.warn('Failed to apply theme:', e);
      }
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
};
