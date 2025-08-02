'use client';

import { create } from 'zustand';
import { NotificationConfig } from '@/types';
import { generateId } from '@/lib/utils';
import { APP_CONFIG } from '@/lib/constants';

interface UIState {
  // Modal state
  activeModal: string | null;
  modalData: any;

  // Loading states
  loading: Record<string, boolean>;

  // Notifications
  notifications: NotificationConfig[];

  // AI Chat state
  chatOpen: boolean;

  // Theme state (handled by useTheme hook, but we can track UI preferences)
  themeMenuOpen: boolean;

  // Actions
  setActiveModal: (modalId: string | null, data?: any) => void;
  closeModal: () => void;

  // Loading actions
  setLoading: (key: string, loading: boolean) => void;
  isLoading: (key: string) => boolean;

  // Notification actions
  addNotification: (notification: Omit<NotificationConfig, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Chat actions
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;

  // Theme menu actions
  toggleThemeMenu: () => void;
  setThemeMenuOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  activeModal: null,
  modalData: null,
  loading: {},
  notifications: [],
  chatOpen: false,
  themeMenuOpen: false,

  // Modal actions
  setActiveModal: (modalId, data = null) => {
    set({ activeModal: modalId, modalData: data });
  },

  closeModal: () => {
    set({ activeModal: null, modalData: null });
  },

  // Loading actions
  setLoading: (key, loading) => {
    set(state => ({
      loading: {
        ...state.loading,
        [key]: loading,
      },
    }));
  },

  isLoading: key => {
    return get().loading[key] || false;
  },

  // Notification actions
  addNotification: notification => {
    const id = generateId();
    const newNotification: NotificationConfig = {
      id,
      duration: APP_CONFIG.DEFAULT_NOTIFICATION_DURATION,
      ...notification,
    };

    set(state => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-remove notification after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }
  },

  removeNotification: id => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  // Chat actions
  toggleChat: () => {
    set(state => ({ chatOpen: !state.chatOpen }));
  },

  setChatOpen: open => {
    set({ chatOpen: open });
  },

  // Theme menu actions
  toggleThemeMenu: () => {
    set(state => ({ themeMenuOpen: !state.themeMenuOpen }));
  },

  setThemeMenuOpen: open => {
    set({ themeMenuOpen: open });
  },
}));

// Helper functions for common UI operations
export const useNotifications = () => {
  const {
    addNotification,
    removeNotification,
    clearNotifications,
    notifications,
  } = useUIStore();

  return {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    // Convenience methods
    showSuccess: (title: string, message: string) =>
      addNotification({ type: 'success', title, message }),
    showError: (title: string, message: string) =>
      addNotification({ type: 'error', title, message }),
    showWarning: (title: string, message: string) =>
      addNotification({ type: 'warning', title, message }),
    showInfo: (title: string, message: string) =>
      addNotification({ type: 'info', title, message }),
  };
};

export const useModal = () => {
  const { activeModal, modalData, setActiveModal, closeModal } = useUIStore();

  return {
    activeModal,
    modalData,
    openModal: setActiveModal,
    closeModal,
    isModalOpen: (modalId: string) => activeModal === modalId,
  };
};

export const useLoading = () => {
  const { loading, setLoading, isLoading } = useUIStore();

  return {
    loading,
    setLoading,
    isLoading,
    // Convenience methods
    startLoading: (key: string) => setLoading(key, true),
    stopLoading: (key: string) => setLoading(key, false),
  };
};

export default useUIStore;
