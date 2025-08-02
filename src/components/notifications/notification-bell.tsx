'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellRing,
  RefreshCw,
  BellOff,
  Clock,
  AlertTriangle,
  TrendingUp,
  Shield,
  User,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  useNotificationStats,
  useNotificationStore,
} from '@/stores/use-notification-store';
import { NotificationItem } from '@/types';

interface NotificationBellProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  size = 'md',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { stats, unreadCount, fetchStats, loading } = useNotificationStats();
  const {
    notifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    loading: storeLoading,
    error,
  } = useNotificationStore();

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
  }, [isOpen]);

  // Fetch stats periodically
  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
    }, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications({ limit: 10 }); // Load recent notifications
    }
  }, [isOpen, fetchNotifications]);

  // Get notification icon based on type
  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = cn(
      'w-4 h-4 flex-shrink-0',
      priority === 'urgent'
        ? 'text-red-500'
        : priority === 'high'
          ? 'text-orange-500'
          : priority === 'medium'
            ? 'text-yellow-500'
            : 'text-blue-500'
    );

    switch (type) {
      case 'trade_alert':
        return <TrendingUp className={iconClass} />;
      case 'price_alert':
        return <Bell className={iconClass} />;
      case 'security':
        return <Shield className={iconClass} />;
      case 'portfolio':
        return <User className={iconClass} />;
      case 'system':
      default:
        return <Info className={iconClass} />;
    }
  };

  // Handle notification click (mark as read)
  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const iconSize = iconSizeClasses[size];

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size={size}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2"
        aria-label="Open notifications"
        aria-expanded={isOpen}
      >
        {unreadCount > 0 ? (
          <BellRing className={cn(iconSize, 'animate-pulse')} />
        ) : (
          <Bell className={iconSize} />
        )}

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-lg z-[60]">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Notifications</h3>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    fetchNotifications({ limit: 10 });
                    fetchStats();
                  }}
                  disabled={storeLoading.notifications || loading}
                  className="p-1"
                >
                  <RefreshCw
                    className={cn(
                      'w-4 h-4',
                      (storeLoading.notifications || loading) && 'animate-spin'
                    )}
                  />
                </Button>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    disabled={storeLoading.markingAllRead}
                    className="text-xs px-2"
                  >
                    Mark All Read
                  </Button>
                )}
              </div>
            </div>
            {stats && (
              <p className="text-xs text-muted-foreground mt-1">
                {unreadCount} unread of {stats.totalCount} total
              </p>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {storeLoading.notifications && notifications.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <BellOff className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No notifications
                </p>
              </div>
            ) : (
              notifications.slice(0, 5).map((notification, index) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50',
                    !notification.isRead && 'bg-accent/10',
                    index < notifications.length - 1 && 'border-b border-border'
                  )}
                >
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(
                        notification.type,
                        notification.priority
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-foreground line-clamp-1">
                          {notification.title}
                        </h4>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatRelativeTime(
                              new Date(notification.createdAt)
                            )}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1">
                          {notification.telegramSent && (
                            <div
                              className="w-2 h-2 bg-green-500 rounded-full"
                              title="Sent via Telegram"
                            />
                          )}
                          <span className="text-xs text-muted-foreground capitalize">
                            {notification.type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 5 && (
            <div className="px-4 py-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to notifications page
                  window.location.href = '/notifications';
                }}
                className="w-full text-sm"
              >
                View All Notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
