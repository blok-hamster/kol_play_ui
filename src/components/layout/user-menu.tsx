'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useUserStore } from '@/stores/use-user-store';
import { useModal } from '@/stores/use-ui-store';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  LogOut,
  HelpCircle,
  Bell,
  ChevronDown,
  Shield,
  Zap,
} from 'lucide-react';
import { useNotifications } from '@/stores/use-ui-store';

const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const { user, signOut } = useUserStore();
  const { openModal } = useModal();
  const { showSuccess } = useNotifications();

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

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsOpen(false);
      showSuccess('Signed Out', 'You have been successfully signed out.');
    } catch (error: any) {
      console.error('Sign out error:', error);
      // Even if API call fails, we still sign out locally
    }
  };

  const handleMenuItemClick = (action: string) => {
    setIsOpen(false);

    switch (action) {
      case 'profile':
        // Navigate to settings page with account tab active
        router.push('/settings?tab=account');
        break;
      case 'settings':
        // Navigate to settings page
        router.push('/settings');
        break;
      case 'notifications':
        // Navigate to notifications page
        router.push('/notifications');
        break;
      case 'help':
        // Navigate to help page (will create if doesn't exist)
        router.push('/help');
        break;
      case 'onboarding':
        // Restart onboarding tour
        openModal('onboarding');
        break;
      default:
        break;
    }
  };

  if (!user) {
    return null;
  }

  const userInitials =
    `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'WU';

  // Determine display name - prioritize displayName, then firstName/lastName, then wallet address
  const displayName = user.displayName || 
    `${user.firstName || ''} ${user.lastName || ''}`.trim() || 
    (user.walletAddress ? `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}` : 'User');

  // Determine display email - show wallet address if no email
  const displayEmail = user.email || 
    (user.walletAddress ? `Wallet: ${user.walletAddress.slice(0, 8)}...` : '');

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Open user menu"
        aria-expanded={isOpen}
      >
        {/* User Avatar */}
        <div className="w-6 h-6 bg-accent-gradient rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-white">
            {userInitials}
          </span>
        </div>

        {/* User Name (hidden on small screens) */}
        <span className="hidden md:inline-block text-sm font-medium truncate max-w-20">
          {user.displayName || user.firstName || (user.walletAddress ? 'Wallet' : 'User')}
        </span>

        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-lg shadow-lg z-[60]">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-accent-gradient rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {userInitials}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {displayEmail}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => handleMenuItemClick('profile')}
              className="w-full px-4 py-2 text-left flex items-center space-x-3 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => handleMenuItemClick('settings')}
              className="w-full px-4 py-2 text-left flex items-center space-x-3 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Settings</span>
            </button>

            <button
              onClick={() => handleMenuItemClick('notifications')}
              className="w-full px-4 py-2 text-left flex items-center space-x-3 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span>Notifications</span>
            </button>

            <div className="border-t border-border my-2"></div>

            <button
              onClick={() => handleMenuItemClick('onboarding')}
              className="w-full px-4 py-2 text-left flex items-center space-x-3 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span>Take Tour</span>
            </button>

            <button
              onClick={() => handleMenuItemClick('help')}
              className="w-full px-4 py-2 text-left flex items-center space-x-3 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span>Help & Support</span>
            </button>

            <div className="border-t border-border my-2"></div>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-left flex items-center space-x-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>KOL Play v1.0</span>
              <div className="flex items-center space-x-1">
                <Shield className="h-3 w-3" />
                <span>Secure</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
