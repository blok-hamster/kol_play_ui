import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import {
  NotificationItem,
  GetNotificationsResponse,
  GetNotificationStatsResponse,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadResponse,
  GetNotificationsQuery,
} from '@/types';

export class NotificationService {
  /**
   * Get user notifications with optional filters
   */
  static async getNotifications(
    query: GetNotificationsQuery = {}
  ): Promise<GetNotificationsResponse> {
    try {
      const params = new URLSearchParams();

      if (query.limit !== undefined)
        params.append('limit', query.limit.toString());
      if (query.offset !== undefined)
        params.append('offset', query.offset.toString());
      if (query.unreadOnly !== undefined)
        params.append('unreadOnly', query.unreadOnly.toString());

      const queryString = params.toString();
      const url = `${API_ENDPOINTS.NOTIFICATIONS.GET_NOTIFICATIONS}${queryString ? `?${queryString}` : ''}`;

      const response =
        await apiClient.get<GetNotificationsResponse['data']>(url);
      return { ...response, success: true };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(): Promise<GetNotificationStatsResponse> {
    try {
      const response = await apiClient.get<
        GetNotificationStatsResponse['data']
      >(API_ENDPOINTS.NOTIFICATIONS.GET_STATS);
      return { ...response, success: true };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Mark a specific notification as read
   */
  static async markNotificationAsRead(
    notificationId: string
  ): Promise<MarkNotificationReadResponse> {
    try {
      await apiClient.put(
        API_ENDPOINTS.NOTIFICATIONS.MARK_READ.replace(':id', notificationId),
        {}
      );
      return {
        success: true,
        message: 'Notification marked as read',
        data: undefined,
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllNotificationsAsRead(): Promise<MarkAllNotificationsReadResponse> {
    try {
      const response = await apiClient.put(
        API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ,
        {}
      );
      return {
        success: true,
        message: response.message || 'All notifications marked as read',
        data: response.data,
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get unread notification count (convenience method)
   */
  static async getUnreadCount(): Promise<number> {
    try {
      const stats = await this.getNotificationStats();
      return stats.data.unreadCount;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Get only unread notifications (convenience method)
   */
  static async getUnreadNotifications(limit = 50): Promise<NotificationItem[]> {
    try {
      const response = await this.getNotifications({
        unreadOnly: true,
        limit,
        offset: 0,
      });
      return response.data.notifications;
    } catch (error) {
      console.error('Failed to get unread notifications:', error);
      return [];
    }
  }
}
