'use client';

import React, { useEffect, useState } from 'react';
import { Bell, TrendingUp, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationStore } from '@/stores/use-notification-store';
import NotificationCenter from '@/components/notifications/notification-center';
import { useRouter } from 'next/navigation';
import RequireAuth from '@/components/auth/require-auth';

export default function NotificationsPage() {
  const router = useRouter();
  const { stats, fetchStats, loading } = useNotificationStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      await fetchStats();
      setIsLoading(false);
    };
    loadStats();
  }, [fetchStats]);

  const handleBackClick = () => {
    router.push('/kols');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <RequireAuth title="Sign In Required" message="Please sign in to view your notifications.">
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackClick}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to KOLs</span>
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center space-x-3">
                  <Bell className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                  <span>Notifications</span>
                </h1>
                <p className="text-muted-foreground mt-1">
                  Manage your trading alerts and system notifications
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStats()}
              disabled={loading.stats}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading.stats ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
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
    </RequireAuth>
  );
}
