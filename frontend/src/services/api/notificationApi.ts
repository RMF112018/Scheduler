/**
 * Notification API Service
 */

import apiClient from './client.js';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  emailDigest: boolean;
  digestFrequency: 'daily' | 'weekly' | 'never';
  mutedTypes: string[];
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

export interface PaginatedNotifications {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
}

/**
 * Get paginated notifications
 */
export async function getNotifications(
  params: GetNotificationsParams = {}
): Promise<PaginatedNotifications> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.unreadOnly) queryParams.set('unreadOnly', 'true');
  if (params.type) queryParams.set('type', params.type);

  const response = await apiClient.get<PaginatedNotifications>(
    `/notifications?${queryParams.toString()}`
  );
  return response.data;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return response.data.count;
}

/**
 * Get notification statistics
 */
export async function getNotificationStats(): Promise<NotificationStats> {
  const response = await apiClient.get<NotificationStats>('/notifications/stats');
  return response.data;
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiClient.get<NotificationPreferences>('/notifications/preferences');
  return response.data;
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const response = await apiClient.put<NotificationPreferences>(
    '/notifications/preferences',
    preferences
  );
  return response.data;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  await apiClient.put(`/notifications/${notificationId}/read`);
}

/**
 * Mark multiple notifications as read
 */
export async function markManyAsRead(notificationIds: string[]): Promise<{ count: number }> {
  const response = await apiClient.put<{ count: number }>('/notifications/read-many', {
    notificationIds,
  });
  return response.data;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<{ count: number }> {
  const response = await apiClient.put<{ count: number }>('/notifications/read-all');
  return response.data;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  await apiClient.delete(`/notifications/${notificationId}`);
}

/**
 * Delete multiple notifications
 */
export async function deleteManyNotifications(
  notificationIds: string[]
): Promise<{ count: number }> {
  const response = await apiClient.delete<{ count: number }>('/notifications/delete-many', {
    data: { notificationIds },
  });
  return response.data;
}

/**
 * Delete all read notifications
 */
export async function deleteAllRead(): Promise<{ count: number }> {
  const response = await apiClient.delete<{ count: number }>('/notifications/delete-read');
  return response.data;
}

export default {
  getNotifications,
  getUnreadCount,
  getNotificationStats,
  getNotificationPreferences,
  updateNotificationPreferences,
  markAsRead,
  markManyAsRead,
  markAllAsRead,
  deleteNotification,
  deleteManyNotifications,
  deleteAllRead,
};
