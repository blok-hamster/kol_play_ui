'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/stores/use-ui-store';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

interface NotificationProviderProps {
  children: React.ReactNode;
}

const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const { notifications, removeNotification } = useUIStore();

  useEffect(() => {
    // Auto-remove notifications after their duration
    const timers: NodeJS.Timeout[] = [];

    notifications.forEach(notification => {
      if (notification.duration && notification.duration > 0) {
        const timer = setTimeout(() => {
          removeNotification(notification.id);
        }, notification.duration);

        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, removeNotification]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <>
      {children}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[110] space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={cn(
              'flex items-start space-x-3 p-4 rounded-lg border shadow-lg max-w-sm w-full transition-all duration-300 ease-in-out',
              getNotificationStyles(notification.type),
              'animate-in slide-in-from-right-full'
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.type)}
            </div>

            <div className="flex-1 min-w-0">
              {notification.title && (
                <p className="text-sm font-semibold text-foreground mb-1">
                  {notification.title}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {notification.message}
              </p>
            </div>

            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default NotificationProvider;
