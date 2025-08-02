'use client';

import React, { useEffect } from 'react';
import { Bell, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useNotificationStore,
  useNotificationStats,
} from '@/stores/use-notification-store';
import NotificationCenter from '@/components/notifications/notification-center';

export default function NotificationsPage() {
  const {
    notifications,
    loading,
    error,
    fetchNotifications,
    fetchStats,
    markAllAsRead,
  } = useNotificationStore();

  const { stats, unreadCount } = useNotificationStats();

  // Fetch notifications on page load
  useEffect(() => {
    fetchNotifications();
    fetchStats();
  }, [fetchNotifications, fetchStats]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Bell className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Notifications
              </h1>
              <p className="text-muted-foreground">
                {stats
                  ? `${unreadCount} unread of ${stats.totalCount} total`
                  : 'Loading...'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                fetchNotifications();
                fetchStats();
              }}
              disabled={loading.notifications}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading.notifications ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>

            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} disabled={loading.markingAllRead}>
                {loading.markingAllRead && (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                )}
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="text-2xl font-bold text-foreground">
                {stats.totalCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Notifications
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="text-2xl font-bold text-primary">
                {stats.unreadCount}
              </div>
              <div className="text-sm text-muted-foreground">Unread</div>
            </div>

            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {stats.telegramSentCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Sent via Telegram
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {stats.priorityStats.high + stats.priorityStats.urgent}
              </div>
              <div className="text-sm text-muted-foreground">High Priority</div>
            </div>
          </div>
        )}

        {/* Full-Screen Notification Center */}
        <div className="min-h-[600px]">
          <NotificationCenter
            isOpen={true}
            onClose={() => {}} // No-op since this is embedded
            embedded={true}
          />
        </div>
      </div>
    </div>
  );
}
