'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/stores/use-ui-store';
import { useUserStore } from '@/stores/use-user-store';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
  Menu,
  X,
  TrendingUp,
  Search,
  ArrowRightLeft,
  PieChart,
  Settings,
  Users,
  Zap,
  HelpCircle,
} from 'lucide-react';
import WalletDropdown from './wallet-dropdown';
import UserMenu from './user-menu';
import ThemeToggle from './theme-toggle';
import NotificationBell from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import { useModal } from '@/stores/use-ui-store';
import TokenSearch from '@/components/tokens/token-search';
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
    icon: TrendingUp,
    description: 'Copy trading leaders',
    // requiresAuth: true, // Temporarily removed for development
  },
  {
    name: 'Subscriptions',
    href: '/subscriptions',
    icon: Users,
    description: 'Manage your copy trades',
    // requiresAuth: true, // Temporarily removed for development
  },
  {
    name: 'Tokens',
    href: '/tokens',
    icon: Search,
    description: 'Discover and analyze tokens',
  },
  {
    name: 'Swap',
    href: '/swap',
    icon: ArrowRightLeft,
    description: 'Trade SOL for tokens',
    // requiresAuth: true, // Temporarily removed for development
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: PieChart,
    description: 'Track your performance',
    // requiresAuth: true, // Temporarily removed for development
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Account and preferences',
    // requiresAuth: true, // Temporarily removed for development
  },
];

const secondaryItems: NavigationItem[] = [
  {
    name: 'AI Assistant',
    href: '/ai-chat',
    icon: Zap,
    description: 'Trading insights and help',
    badge: 'Beta',
    // requiresAuth: true, // Temporarily removed for development
  },
  {
    name: 'Community',
    href: '/community',
    icon: Users,
    description: 'Connect with traders',
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleAuthClick = () => {
    openModal('auth');
  };

  const handleMobileSearch = () => {
    setIsMobileMenuOpen(false); // Close mobile menu if open
    setIsMobileSearchOpen(true);
    // Focus on search input after overlay opens
    setTimeout(() => {
      const searchInput = document.querySelector(
        '[placeholder*="Search"]'
      ) as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
  };

  const closeMobileSearch = () => {
    setIsMobileSearchOpen(false);
  };

  // Close mobile search when token modal opens
  // useEffect(() => {
  //   if (!isMobileSearchOpen) return;

  //   const checkForTokenModal = () => {
  //     // Look for modal elements with high z-index
  //     const highZElements = document.querySelectorAll('.fixed[class*="z-5"], .fixed[class*="z-[5"]');
  //     for (const element of Array.from(highZElements)) {
  //       const computedStyle = window.getComputedStyle(element);
  //       const rect = element.getBoundingClientRect();

  //       // Check if it's visible and not our search overlay
  //       if (rect.width > 0 && rect.height > 0 &&
  //           parseInt(computedStyle.zIndex) >= 50 &&
  //           !element.textContent?.includes('Search tokens')) {
  //         setIsMobileSearchOpen(false);
  //         break;
  //       }
  //     }
  //   };

  //   // Check after a short delay to allow modal to render
  //   const timeout = setTimeout(checkForTokenModal, 200);
  //   return () => clearTimeout(timeout);
  // }, [isMobileSearchOpen]);

  const toggleMobileMenu = () => {
    setIsMobileSearchOpen(false); // Close mobile search if open
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return pathname === '/';
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
          'group flex items-center rounded-lg px-2 py-1.5 text-sm font-medium transition-all duration-200',
          'hover:bg-muted focus:bg-muted focus:outline-none',
          isActive && 'bg-accent-gradient text-white shadow-sm',
          isDisabled && 'opacity-50 cursor-not-allowed',
          isMobile ? 'justify-start' : 'justify-center',
          !isMobile && 'flex-col space-y-0.5 min-w-[70px]'
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
            'h-4 w-4 flex-shrink-0 transition-colors',
            isActive
              ? 'text-white'
              : 'text-muted-foreground group-hover:text-foreground',
            isMobile ? 'mr-3' : 'mb-0.5'
          )}
        />

        <span
          className={cn(
            'transition-colors',
            isActive
              ? 'text-white'
              : 'text-foreground group-hover:text-foreground',
            !isMobile && 'text-xs text-center'
          )}
        >
          {item.name}
        </span>

        {item.badge && (
          <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
            {item.badge}
          </span>
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
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        {/* Left Section - Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <Image
              src="/4.png"
              alt="KOL Play Logo"
              width={200}
              height={200}
              className="hover:opacity-90 transition-opacity"
            />
          </Link>
        </div>

        {/* Center Section - Global Search (Desktop) */}
        <div className="flex-1 max-w-lg mx-6 hidden lg:block">
          <TokenSearch />
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

          {/* Mobile search button */}
          <button
            onClick={handleMobileSearch}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:hidden"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
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

      {/* Navigation Bar - Desktop Only */}
      <div className="border-t border-border bg-muted/30 hidden lg:block relative z-50 pointer-events-auto">
        <div className="px-6 py-2">
          <nav className="flex items-center justify-between">
            {/* Main Navigation Items */}
            <div className="flex items-center justify-evenly flex-1 max-w-2xl">
              {navigationItems.map(item => renderNavigationItem(item))}
            </div>

            {/* Separator */}
            <div className="h-6 w-px bg-border mx-6" />

            {/* Secondary Navigation Items */}
            <div className="flex items-center justify-evenly flex-1 max-w-xl">
              {secondaryItems.map(item => renderNavigationItem(item))}
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {isMobileSearchOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-x-0 top-14 bottom-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={closeMobileSearch}
          />

          {/* Search Panel */}
          <div className="fixed top-14 left-0 right-0 bg-background border-b border-border shadow-2xl z-[60] lg:hidden">
            <div className="p-4">
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <TokenSearch />
                </div>
                <button
                  onClick={closeMobileSearch}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
            <div className="p-4 space-y-1">
              {/* Main Navigation Items */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                  Main
                </div>
                {navigationItems.map(item => {
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

              {/* Mobile Search */}
              <div className="pt-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                  Search
                </div>
                <div className="px-3">
                  <TokenSearch />
                </div>
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
