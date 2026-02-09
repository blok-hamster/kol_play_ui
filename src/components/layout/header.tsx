'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/stores/use-user-store';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
  Menu,
  X,
  Compass,
  Radar,
  Repeat,
  Coins,
  Wallet,
  Sliders,
  Brain,
  HelpCircle,
  TrendingUp,
  Gamepad2,
} from 'lucide-react';
import WalletDropdown from './wallet-dropdown';
import UserMenu from './user-menu';
import ThemeToggle from './theme-toggle';
import NotificationBell from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import { useModal, useUIStore } from '@/stores/use-ui-store';
import { NetworkModeSelector } from './network-mode-selector';
import type { LucideIcon } from 'lucide-react';

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
  requiresAuth?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    name: 'KOLs',
    href: '/kols',
    icon: Compass,
    description: 'Copy trading leaders',
  },
  {
    name: 'Live Trades',
    href: '/kol-trades',
    icon: Radar,
    description: 'Real-time KOL trades & network maps',
  },
  {
    name: 'Subscriptions',
    href: '/subscriptions',
    icon: Repeat,
    description: 'Manage your copy trades',
  },
  {
    name: 'Tokens',
    href: '/tokens',
    icon: Coins,
    description: 'Discover and analyze tokens',
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: Wallet,
    description: 'Track your performance',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Sliders,
    description: 'Account and preferences',
  },
];

const proNavigationItems: NavigationItem[] = [
  {
    name: 'The Trenches',
    href: '/pro-terminal',
    icon: Radar,
    description: 'Live market pulse',
  },
  {
    name: 'Trading Terminal',
    href: '/pro-terminal/trade',
    icon: TrendingUp,
    description: 'Advanced execution & charts',
  },
  {
    name: 'Analytics',
    href: '/pro-terminal/analytics',
    icon: TrendingUp, // Reusing TrendingUp or could import LineChart
    description: 'Deep market analysis',
  },
  {
    name: 'AFK Mode',
    href: '/pro-terminal/afk',
    icon: Gamepad2,
    description: 'Automated trading & agents',
    badge: 'NEW',
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: Wallet,
    description: 'Track your performance',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Sliders,
    description: 'Configuration',
  },
];

const secondaryItems: NavigationItem[] = [
  {
    name: 'AI Assistant',
    href: '/agent',
    icon: Brain,
    description: 'Trading insights and help',
  },
  {
    name: 'Help & Support',
    href: '/help',
    icon: HelpCircle,
    description: 'Get assistance',
  },
];

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
  const pathname = usePathname();
  const { isAuthenticated } = useUserStore();
  const { openModal } = useModal();
  const { isProMode } = useUIStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const currentNavItems = isProMode ? proNavigationItems : navigationItems;

  const handleAuthClick = () => {
    openModal('auth');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActiveRoute = (href: string) => {
    if (href === '/' || href === '/pro-terminal') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const renderNavigationItem = (item: NavigationItem, isMobile = false) => {
    const isActive = isActiveRoute(item.href);
    const isDisabled = Boolean(item.requiresAuth) && !isAuthenticated;
    const IconComponent = item.icon;

    return (
      <Link
        key={item.name}
        href={isDisabled ? '#' : item.href}
        className={cn(
          'group relative flex items-center rounded-lg px-3 py-1.5 text-sm md:text-[15px] font-semibold transition-all duration-300',
          'hover:bg-primary/5 focus:outline-none',
          isActive && 'text-primary',
          isDisabled && 'opacity-50 cursor-not-allowed',
          isMobile ? 'justify-start w-full' : 'justify-center flex-col min-w-[80px] h-12',
        )}
        onClick={e => {
          if (isDisabled) {
            e.preventDefault();
          }
        }}
        title={item.description}
      >
        <IconComponent
          className={cn(
            'flex-shrink-0 transition-all duration-300 transform',
            isMobile ? 'h-5 w-5 mr-3' : 'h-4 w-4 mb-1',
            !isMobile && !isActive && 'opacity-0 -translate-y-2 scale-75 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100',
            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary',
          )}
        />

        <span
          className={cn(
            'transition-all duration-300',
            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary',
            !isMobile && 'text-xs md:text-[13px] text-center whitespace-nowrap uppercase tracking-wider'
          )}
        >
          {item.name}
        </span>

        {item.badge && (
          isMobile ? (
            <span className="ml-2 rounded-full bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
              {item.badge}
            </span>
          ) : (
            <span className="absolute -top-1 -right-1 rounded-full bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
              {item.badge}
            </span>
          )
        )}
      </Link>
    );
  };

  return (
    <header
      className={cn(
        'bg-background/95 backdrop-blur-sm border-b border-border fixed top-0 left-0 right-0 z-50',
        className
      )}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between h-14 px-4 lg:px-6 relative z-[60]">
        {/* Left Section - Logo */}
        <div className="flex items-center">
          <Link href={isProMode ? "/pro-terminal" : "/"} className="flex items-center">
            {/* Mobile logo */}
            <Image
              src="/6.png"
              alt="KOL Play Logo"
              width={200}
              height={200}
              className="h-6 w-auto hover:opacity-90 transition-opacity block lg:hidden"
              priority
            />
            {/* Desktop logo (larger) */}
            <Image
              src="/4.png"
              alt="KOL Play Logo"
              width={240}
              height={240}
              className="hidden lg:block w-36 h-auto hover:opacity-90 transition-opacity"
              priority
            />
          </Link>
        </div>

        {/* Center Section - Network & Mode Selector (Desktop) */}
        <div className="flex-1 flex justify-center mx-6 hidden lg:flex">
          <NetworkModeSelector />
        </div>

        {/* Right Section - Actions and User */}
        <div className="flex items-center space-x-2">
          {/* Mobile hamburger menu button */}
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:hidden"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          {/* Theme Toggle */}
          <ThemeToggle size="sm" />

          {isAuthenticated ? (
            <>
              {/* Notification Bell */}
              <NotificationBell size="sm" />

              {/* Wallet Dropdown */}
              <WalletDropdown />

              {/* User Menu */}
              <UserMenu />
            </>
          ) : (
            /* Sign In Button */
            <Button
              onClick={handleAuthClick}
              variant="gradient"
              size="sm"
              className="hidden sm:inline-flex text-white"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Bar - Desktop Only - Static Text-First */}
      <div className="hidden lg:block border-t border-border bg-background/50 backdrop-blur-md relative z-[55]">
        <div className="container mx-auto px-6 h-12 flex items-center justify-center">
          <nav className="flex items-center gap-10">
            {/* Main Navigation Items */}
            <div className="flex items-center gap-4">
              {currentNavItems.map(item => renderNavigationItem(item))}
            </div>

            {/* Premium Separator */}
            <div className="h-4 w-px bg-gradient-to-b from-transparent via-border to-transparent mx-2" />

            {/* Secondary Navigation Items */}
            <div className="flex items-center gap-4">
              {secondaryItems.map(item => renderNavigationItem(item))}
            </div>
          </nav>
        </div>

        {/* Full-Width Persistent Gradient Line */}
        <div className="h-[2px] w-full bg-accent-gradient opacity-90 shadow-[0_0_10px_rgba(20,241,149,0.2)]" />
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-x-0 top-14 bottom-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={closeMobileMenu}
          />

          {/* Menu Panel */}
          <div className="fixed top-14 left-0 right-0 bg-background border-b border-border shadow-2xl z-[60] max-h-[calc(100vh-3.5rem)] overflow-y-auto lg:hidden">
            <div className="p-4 space-y-4">
              {/* Network Mode Selector (Mobile) */}
              <div className="space-y-3 p-3 bg-muted/20 rounded-xl border border-border/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Trading Controls</span>
                <div className="flex justify-center">
                  <NetworkModeSelector className="w-full justify-between bg-background shadow-sm border-border/60" />
                </div>
              </div>

              {/* Main Navigation Items */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                  {isProMode ? 'Pro Terminal' : 'Main'}
                </div>
                {currentNavItems.map(item => {
                  const isActive = isActiveRoute(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={
                        item.requiresAuth && !isAuthenticated ? '#' : item.href
                      }
                      className={cn(
                        'flex items-center space-x-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                        'hover:bg-muted focus:bg-muted focus:outline-none',
                        isActive && 'bg-accent-gradient text-white shadow-sm',
                        item.requiresAuth &&
                        !isAuthenticated &&
                        'opacity-50 cursor-not-allowed'
                      )}
                      onClick={e => {
                        if (item.requiresAuth && !isAuthenticated) {
                          e.preventDefault();
                        } else {
                          closeMobileMenu();
                        }
                      }}
                    >
                      <item.icon
                        className={cn(
                          'h-5 w-5 flex-shrink-0',
                          isActive ? 'text-white' : ''
                        )}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              isActive ? 'text-white' : 'text-foreground'
                            )}
                          >
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className="rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            'text-xs mt-0.5',
                            isActive ? 'text-white/80' : 'text-muted-foreground'
                          )}
                        >
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Separator */}
              <div className="h-px bg-border my-4" />

              {/* Secondary Navigation Items */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                  More
                </div>
                {secondaryItems.map(item => {
                  const isActive = isActiveRoute(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={
                        item.requiresAuth && !isAuthenticated ? '#' : item.href
                      }
                      className={cn(
                        'flex items-center space-x-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                        'hover:bg-muted focus:bg-muted focus:outline-none',
                        isActive && 'bg-accent-gradient text-white shadow-sm',
                        item.requiresAuth &&
                        !isAuthenticated &&
                        'opacity-50 cursor-not-allowed'
                      )}
                      onClick={e => {
                        if (item.requiresAuth && !isAuthenticated) {
                          e.preventDefault();
                        } else {
                          closeMobileMenu();
                        }
                      }}
                    >
                      <item.icon
                        className={cn(
                          'h-5 w-5 flex-shrink-0',
                          isActive ? 'text-white' : ''
                        )}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              isActive ? 'text-white' : 'text-foreground'
                            )}
                          >
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className="rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            'text-xs mt-0.5',
                            isActive ? 'text-white/80' : 'text-muted-foreground'
                          )}
                        >
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Auth Section for Mobile */}
              {!isAuthenticated && (
                <div className="pt-4 px-3">
                  <Button
                    onClick={() => {
                      handleAuthClick();
                      closeMobileMenu();
                    }}
                    variant="gradient"
                    className="w-full text-white"
                  >
                    Sign In
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;
