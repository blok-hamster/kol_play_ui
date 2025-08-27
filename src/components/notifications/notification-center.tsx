'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  BellOff,
  CheckCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  Shield,
  User,
  Clock,
  Filter,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useNotificationStore } from '@/stores/use-notification-store';
import { NotificationItem } from '@/types';
import TradeDetailsModal from './trade-details-modal';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean; // New prop for embedded mode
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  embedded = false,
}) => {
  const {
    notifications,
    stats,
    loading,
    error,
    fetchNotifications,
    fetchStats,
    markAsRead,
    markAllAsRead,
    loadMore,
    refresh,
    clearError,
  } = useNotificationStore();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

  // Fetch notifications and stats on mount
  useEffect(() => {
    if (isOpen) {
      fetchNotifications({ unreadOnly: filter === 'unread' });
      fetchStats();
    }
  }, [isOpen, filter]);

  // Handle filter change
  const handleFilterChange = (newFilter: 'all' | 'unread') => {
    setFilter(newFilter);
    fetchNotifications({ unreadOnly: newFilter === 'unread' });
  };

  // Handle type filter change
  const handleTypeFilterChange = (type: string) => {
    setTypeFilter(type);
    // Note: Type filtering would typically be done on the backend,
    // but for now we'll filter client-side
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = cn(
      'w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0',
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
      case 'client_notification':
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

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'high':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
      case 'low':
      default:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10';
    }
  };

  // Filter notifications by type
  const filteredNotifications =
    typeFilter === 'all'
      ? notifications
      : notifications.filter(n => n.type === typeFilter);

  // Handle notification click (mark as read and potentially show trade details)
  const handleNotificationClick = async (notification: NotificationItem) => {
    const isRead = notification.isRead ?? notification.read ?? false;
    if (!isRead) {
      await markAsRead(notification.id);
    }

    // Check if notification has trade data
    if (notification.data?.trade) {
      setSelectedNotification(notification);
      setIsTradeModalOpen(true);
    }
  };

  const handleTradeModalClose = () => {
    setIsTradeModalOpen(false);
    setSelectedNotification(null);
  };

  if (!isOpen && !embedded) return null;

  // Embedded mode (for notifications page)
  if (embedded) {
    return (
      <div className="bg-background border border-border rounded-lg flex flex-col h-full min-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                Notifications
              </h2>
              {stats && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {stats.unreadCount} unread of {stats.totalCount} total
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading.notifications}
              className="p-2"
            >
              <RefreshCw
                className={cn(
                  'w-4 h-4',
                  loading.notifications && 'animate-spin'
                )}
              />
            </Button>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="p-3 sm:p-4 border-b border-border space-y-3 flex-shrink-0">
          {/* Filter Toggle */}
          <div className="flex items-center space-x-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('all')}
              className="flex-1 sm:flex-none"
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('unread')}
              className="flex-1 sm:flex-none"
            >
              Unread ({stats?.unreadCount || 0})
            </Button>
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <select
              value={typeFilter}
              onChange={e => handleTypeFilterChange(e.target.value)}
              className="text-xs sm:text-sm bg-background border border-border rounded px-2 py-1 text-foreground"
            >
              <option value="all">All Types</option>
              <option value="trade_alert">Trade Alerts</option>
              <option value="client_notification">Client Notifications</option>
              <option value="price_alert">Price Alerts</option>
              <option value="portfolio">Portfolio</option>
              <option value="security">Security</option>
              <option value="system">System</option>
            </select>

            {stats && stats.unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={loading.markingAllRead}
                className="text-xs"
              >
                {loading.markingAllRead && (
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                )}
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex-shrink-0">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
                <button
                  onClick={clearError}
                  className="text-xs text-red-600 hover:text-red-800 mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading.notifications && filteredNotifications.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <BellOff className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-sm font-medium text-foreground mb-2">
                No notifications
              </h3>
              <p className="text-xs text-muted-foreground">
                {filter === 'unread'
                  ? 'All caught up!'
                  : 'New notifications will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredNotifications.map((notification, index) => {
                return (
                <div
                  key={notification.id}
                  onClick={() => {
                    handleNotificationClick(notification);
                  }}
                  className={cn(
                    'p-3 sm:p-4 border-b border-border cursor-pointer transition-all duration-200',
                    'hover:bg-muted/50 active:bg-muted border-l-4',
                    getPriorityColor(notification.priority),
                    !(notification.isRead ?? notification.read ?? false) ? 'bg-accent/20' : 'opacity-75',
                    notification.data?.trade && 'hover:border-l-primary' // Highlight trade notifications
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
                        <h4 className="text-sm font-medium text-foreground line-clamp-2">
                          {notification.title}
                          {notification.data?.trade && (
                            <span className="ml-2 text-xs text-primary">
                              • Click for details
                            </span>
                          )}
                        </h4>

                        {!(notification.isRead ?? notification.read ?? false) && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatRelativeTime(
                              new Date(notification.createdAt || notification.timestamp || Date.now())
                            )}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1">
                          {(notification.telegramSent || notification.sentToTelegram) && (
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
                );
              })}
            </div>
          )}
        </div>

        {/* Load More Button */}
        {filteredNotifications.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-border flex-shrink-0">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loading.notifications}
              className="w-full"
              size="sm"
            >
              {loading.notifications && (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              )}
              Load More
            </Button>
          </div>
        )}

        {/* Trade Details Modal */}
        <TradeDetailsModal
          isOpen={isTradeModalOpen}
          onClose={handleTradeModalClose}
          notification={selectedNotification}
        />
      </div>
    );
  }

  // Dropdown mode (default)
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Notification Panel */}
      <div className={cn(
        // Mobile: Fixed overlay with safe margins
        'fixed inset-4 sm:inset-y-0 sm:right-0 sm:inset-x-auto',
        'w-auto sm:w-96 bg-background border border-border sm:border-l rounded-lg sm:rounded-none sm:rounded-l-lg shadow-xl z-[70]',
        'flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-screen',
        'animate-in slide-in-from-bottom-5 sm:slide-in-from-right duration-300'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                Notifications
              </h2>
              {stats && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {stats.unreadCount} unread of {stats.totalCount} total
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading.notifications}
              className="p-2"
            >
              <RefreshCw
                className={cn(
                  'w-4 h-4',
                  loading.notifications && 'animate-spin'
                )}
              />
            </Button>

            <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="p-3 sm:p-4 border-b border-border space-y-3">
          {/* Filter Toggle */}
          <div className="flex items-center space-x-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('all')}
              className="flex-1 sm:flex-none"
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('unread')}
              className="flex-1 sm:flex-none"
            >
              Unread ({stats?.unreadCount || 0})
            </Button>
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <select
              value={typeFilter}
              onChange={e => handleTypeFilterChange(e.target.value)}
              className="text-xs sm:text-sm bg-background border border-border rounded px-2 py-1 text-foreground"
            >
              <option value="all">All Types</option>
              <option value="trade_alert">Trade Alerts</option>
              <option value="client_notification">Client Notifications</option>
              <option value="price_alert">Price Alerts</option>
              <option value="portfolio">Portfolio</option>
              <option value="security">Security</option>
              <option value="system">System</option>
            </select>

            {stats && stats.unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={loading.markingAllRead}
                className="text-xs"
              >
                {loading.markingAllRead && (
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                )}
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
                <button
                  onClick={clearError}
                  className="text-xs text-red-600 hover:text-red-800 mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading.notifications && filteredNotifications.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <BellOff className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-sm font-medium text-foreground mb-2">
                No notifications
              </h3>
              <p className="text-xs text-muted-foreground">
                {filter === 'unread'
                  ? 'All caught up!'
                  : 'New notifications will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'p-3 sm:p-4 border-b border-border cursor-pointer transition-all duration-200',
                    'hover:bg-muted/50 active:bg-muted border-l-4',
                    getPriorityColor(notification.priority),
                    !(notification.isRead ?? notification.read ?? false) ? 'bg-accent/20' : 'opacity-75',
                    notification.data?.trade && 'hover:border-l-primary' // Highlight trade notifications
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
                        <h4 className="text-sm font-medium text-foreground line-clamp-2">
                          {notification.title}
                          {notification.data?.trade && (
                            <span className="ml-2 text-xs text-primary">
                              • Click for details
                            </span>
                          )}
                        </h4>

                        {!(notification.isRead ?? notification.read ?? false) && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatRelativeTime(
                              new Date(notification.createdAt || notification.timestamp || Date.now())
                            )}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1">
                          {(notification.telegramSent || notification.sentToTelegram) && (
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
              ))}
            </div>
          )}
        </div>

        {/* Load More Button */}
        {filteredNotifications.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-border">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loading.notifications}
              className="w-full"
              size="sm"
            >
              {loading.notifications && (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              )}
              Load More
            </Button>
          </div>
        )}

        {/* Trade Details Modal */}
        <TradeDetailsModal
          isOpen={isTradeModalOpen}
          onClose={handleTradeModalClose}
          notification={selectedNotification}
        />
      </div>
    </>
  );
};

export default NotificationCenter;
