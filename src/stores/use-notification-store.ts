import { create } from 'zustand';
import {
  NotificationItem,
  PaginationInfo,
  NotificationMetadata,
  GetNotificationStatsResponse,
} from '@/types';
import { NotificationService } from '@/services/notification.service';

interface NotificationState {
  // State
  notifications: NotificationItem[];
  stats: GetNotificationStatsResponse['data'] | null;
  pagination: PaginationInfo | null;
  metadata: NotificationMetadata | null;
  loading: {
    notifications: boolean;
    stats: boolean;
    markingRead: boolean;
    markingAllRead: boolean;
  };
  error: string | null;

  // Actions
  fetchNotifications: (query?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }) => Promise<void>;
  fetchStats: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;

  // Local state management
  updateNotificationRead: (notificationId: string, isRead: boolean) => void;
  addNotification: (notification: NotificationItem) => void;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // Initial state
  notifications: [],
  stats: null,
  pagination: null,
  metadata: null,
  loading: {
    notifications: false,
    stats: false,
    markingRead: false,
    markingAllRead: false,
  },
  error: null,

  // Fetch notifications with optional query parameters
  fetchNotifications: async (query = {}) => {
    try {
      set(state => ({
        loading: { ...state.loading, notifications: true },
        error: null,
      }));

      const response = await NotificationService.getNotifications(query);

      set({
        notifications: response.data.notifications,
        pagination: response.data.pagination,
        metadata: response.data.metadata,
        loading: { ...get().loading, notifications: false },
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch notifications',
        loading: { ...get().loading, notifications: false },
      });
    }
  },

  // Fetch notification statistics
  fetchStats: async () => {
    try {
      set(state => ({
        loading: { ...state.loading, stats: true },
        error: null,
      }));

      const response = await NotificationService.getNotificationStats();

      set({
        stats: response.data,
        loading: { ...get().loading, stats: false },
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch notification stats',
        loading: { ...get().loading, stats: false },
      });
    }
  },

  // Mark a specific notification as read
  markAsRead: async (notificationId: string) => {
    try {
      set(state => ({
        loading: { ...state.loading, markingRead: true },
        error: null,
      }));

      await NotificationService.markNotificationAsRead(notificationId);

      // Update local state
      get().updateNotificationRead(notificationId, true);

      // Refresh stats to get updated counts
      await get().fetchStats();

      set(state => ({
        loading: { ...state.loading, markingRead: false },
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to mark notification as read',
        loading: { ...get().loading, markingRead: false },
      });
    }
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    try {
      set(state => ({
        loading: { ...state.loading, markingAllRead: true },
        error: null,
      }));

      await NotificationService.markAllNotificationsAsRead();

      // Update all notifications in local state
      set(state => ({
        notifications: state.notifications.map(notification => ({
          ...notification,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
        loading: { ...state.loading, markingAllRead: false },
      }));

      // Refresh stats
      await get().fetchStats();
    } catch (error: any) {
      set({
        error: error.message || 'Failed to mark all notifications as read',
        loading: { ...get().loading, markingAllRead: false },
      });
    }
  },

  // Load more notifications (pagination)
  loadMore: async () => {
    const { pagination } = get();
    if (!pagination || !pagination.hasMore) return;

    try {
      set(state => ({
        loading: { ...state.loading, notifications: true },
        error: null,
      }));

      const response = await NotificationService.getNotifications({
        limit: pagination.limit,
        offset: pagination.offset + pagination.limit,
      });

      set(state => ({
        notifications: [...state.notifications, ...response.data.notifications],
        pagination: response.data.pagination,
        metadata: response.data.metadata,
        loading: { ...state.loading, notifications: false },
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to load more notifications',
        loading: { ...get().loading, notifications: false },
      });
    }
  },

  // Refresh current notifications
  refresh: async () => {
    const { pagination } = get();
    await get().fetchNotifications({
      limit: pagination?.limit || 50,
      offset: 0,
    });
    await get().fetchStats();
  },

  // Update notification read status locally
  updateNotificationRead: (notificationId: string, isRead: boolean) => {
    set(state => ({
      notifications: state.notifications.map(notification =>
        notification.id === notificationId
          ? {
              ...notification,
              isRead,
              readAt: isRead ? new Date().toISOString() : undefined,
            }
          : notification
      ),
    }));
  },

  // Add new notification (e.g., from WebSocket)
  addNotification: (notification: NotificationItem) => {
    set(state => ({
      notifications: [notification, ...state.notifications],
    }));
  },

  // Clear error state
  clearError: () => {
    set({ error: null });
  },
}));

// Convenience hooks
export const useNotifications = () => {
  const store = useNotificationStore();
  return {
    notifications: store.notifications,
    loading: store.loading.notifications,
    error: store.error,
    fetchNotifications: store.fetchNotifications,
    markAsRead: store.markAsRead,
    refresh: store.refresh,
  };
};

export const useNotificationStats = () => {
  const store = useNotificationStore();
  return {
    stats: store.stats,
    loading: store.loading.stats,
    fetchStats: store.fetchStats,
    unreadCount: store.stats?.unreadCount || 0,
  };
};
