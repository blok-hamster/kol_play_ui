'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { Sun, Moon, Monitor } from 'lucide-react';

type ThemeOption = {
  value: 'light' | 'dark' | 'system';
  label: string;
  icon: React.ReactNode;
};

const themeOptions: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
];

interface ThemeToggleProps {
  align?: 'left' | 'right';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({
  align = 'right',
  showLabel = false,
  size = 'md',
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Debug logging
  useEffect(() => {
    void 0 && ('🎨 Theme Toggle Debug:', {
      theme,
      resolvedTheme,
      documentClass: document.documentElement.className,
    });
  }, [theme, resolvedTheme]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }

    return undefined;
  }, [isOpen]);

  const currentTheme =
    themeOptions.find(option => option.value === theme) || themeOptions[2];

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  const handleThemeSelect = (newTheme: 'light' | 'dark' | 'system') => {
    void 0 && ('🎨 Theme changing from', theme, 'to', newTheme);
    setTheme(newTheme);
    setIsOpen(false);

    // Force immediate UI update check
    setTimeout(() => {
      void 0 && ('🎨 After theme change:', {
        theme: newTheme,
        documentClass: document.documentElement.className,
        computedBackground: getComputedStyle(
          document.documentElement
        ).getPropertyValue('--background'),
        bodyBackgroundColor: getComputedStyle(document.body).backgroundColor,
      });
    }, 100);

    // Announce theme change to screen readers
    const announcement = `Theme changed to ${newTheme === 'system' ? 'system preference' : newTheme} mode`;
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.setAttribute('aria-atomic', 'true');
    ariaLive.className = 'sr-only';
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Toggle Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          sizeClasses[size],
          showLabel && 'px-3 w-auto space-x-2'
        )}
        aria-label={`Current theme: ${currentTheme.label} (resolved: ${resolvedTheme}). Click to change theme`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={`Current: ${currentTheme.label} (${resolvedTheme})`}
      >
        {currentTheme.icon}
        {showLabel && (
          <span className="hidden sm:inline-block">{currentTheme.label}</span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-2 w-48 py-2 bg-popover border border-border rounded-lg shadow-lg z-[60]',
            // Mobile: centered, Desktop: respect align prop
            'left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0',
            align === 'left' ? 'sm:left-0' : 'sm:right-0'
          )}
          role="menu"
          aria-labelledby="theme-toggle-button"
        >
          {themeOptions.map(option => (
            <button
              key={option.value}
              onClick={() => handleThemeSelect(option.value)}
              className={cn(
                'w-full flex items-center px-4 py-2 text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none',
                theme === option.value &&
                  'bg-accent text-accent-foreground font-medium'
              )}
              role="menuitem"
              tabIndex={0}
            >
              <span className="mr-3 flex-shrink-0">{option.icon}</span>
              <span className="flex-1">{option.label}</span>
              {theme === option.value && (
                <span className="ml-2 text-xs opacity-60">
                  {option.value === 'system' ? `(${resolvedTheme})` : 'active'}
                </span>
              )}
            </button>
          ))}

          {/* Debug info */}
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border mt-2">
            Theme: {theme} → {resolvedTheme}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
