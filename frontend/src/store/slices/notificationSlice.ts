/**
 * Notification Redux Slice
 *
 * Manages notification state including:
 * - Notification list with pagination
 * - Unread count
 * - Real-time updates via Socket.io
 * - User preferences
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as notificationApi from '../../services/api/notificationApi.js';
import type {
  Notification,
  NotificationPreferences,
  NotificationStats,
  PaginatedNotifications,
  GetNotificationsParams,
} from '../../services/api/notificationApi.js';

// State interface
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  stats: NotificationStats | null;
  preferences: NotificationPreferences | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  error: string | null;
  // Toast notifications for real-time alerts
  toasts: Array<{
    id: string;
    notification: Notification;
    timestamp: number;
  }>;
}

// Initial state
const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  stats: null,
  preferences: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  loading: false,
  error: null,
  toasts: [],
};

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params: GetNotificationsParams = {}) => {
    return await notificationApi.getNotifications(params);
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async () => {
    return await notificationApi.getUnreadCount();
  }
);

export const fetchNotificationStats = createAsyncThunk(
  'notifications/fetchStats',
  async () => {
    return await notificationApi.getNotificationStats();
  }
);

export const fetchNotificationPreferences = createAsyncThunk(
  'notifications/fetchPreferences',
  async () => {
    return await notificationApi.getNotificationPreferences();
  }
);

export const updateNotificationPreferences = createAsyncThunk(
  'notifications/updatePreferences',
  async (preferences: Partial<NotificationPreferences>) => {
    return await notificationApi.updateNotificationPreferences(preferences);
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string) => {
    await notificationApi.markAsRead(notificationId);
    return notificationId;
  }
);

export const markManyNotificationsAsRead = createAsyncThunk(
  'notifications/markManyAsRead',
  async (notificationIds: string[]) => {
    await notificationApi.markManyAsRead(notificationIds);
    return notificationIds;
  }
);

export const markAllNotificationsAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async () => {
    const result = await notificationApi.markAllAsRead();
    return result.count;
  }
);

export const deleteNotification = createAsyncThunk(
  'notifications/delete',
  async (notificationId: string) => {
    await notificationApi.deleteNotification(notificationId);
    return notificationId;
  }
);

export const deleteManyNotifications = createAsyncThunk(
  'notifications/deleteMany',
  async (notificationIds: string[]) => {
    await notificationApi.deleteManyNotifications(notificationIds);
    return notificationIds;
  }
);

export const deleteAllReadNotifications = createAsyncThunk(
  'notifications/deleteAllRead',
  async () => {
    const result = await notificationApi.deleteAllRead();
    return result.count;
  }
);

// Slice
const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Add a new notification from real-time event
    addNotification: (state, action: PayloadAction<Notification>) => {
      // Add to the beginning of the list
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
      state.pagination.total += 1;

      // Add toast for real-time alert
      state.toasts.push({
        id: action.payload.id,
        notification: action.payload,
        timestamp: Date.now(),
      });

      // Keep only last 5 toasts
      if (state.toasts.length > 5) {
        state.toasts = state.toasts.slice(-5);
      }
    },

    // Update unread count from real-time event
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = action.payload;
    },

    // Dismiss a toast notification
    dismissToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },

    // Clear all toasts
    clearToasts: (state) => {
      state.toasts = [];
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },

    // Reset state (e.g., on logout)
    resetNotifications: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch notifications
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action: PayloadAction<PaginatedNotifications>) => {
        state.loading = false;
        state.notifications = action.payload.notifications;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch notifications';
      });

    // Fetch unread count
    builder
      .addCase(fetchUnreadCount.fulfilled, (state, action: PayloadAction<number>) => {
        state.unreadCount = action.payload;
      });

    // Fetch stats
    builder
      .addCase(fetchNotificationStats.fulfilled, (state, action: PayloadAction<NotificationStats>) => {
        state.stats = action.payload;
      });

    // Fetch preferences
    builder
      .addCase(fetchNotificationPreferences.fulfilled, (state, action: PayloadAction<NotificationPreferences>) => {
        state.preferences = action.payload;
      });

    // Update preferences
    builder
      .addCase(updateNotificationPreferences.fulfilled, (state, action: PayloadAction<NotificationPreferences>) => {
        state.preferences = action.payload;
      });

    // Mark as read
    builder
      .addCase(markNotificationAsRead.fulfilled, (state, action: PayloadAction<string>) => {
        const notification = state.notifications.find((n) => n.id === action.payload);
        if (notification && !notification.read) {
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      });

    // Mark many as read
    builder
      .addCase(markManyNotificationsAsRead.fulfilled, (state, action: PayloadAction<string[]>) => {
        let markedCount = 0;
        action.payload.forEach((id) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (notification && !notification.read) {
            notification.read = true;
            markedCount++;
          }
        });
        state.unreadCount = Math.max(0, state.unreadCount - markedCount);
      });

    // Mark all as read
    builder
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.notifications.forEach((n) => {
          n.read = true;
        });
        state.unreadCount = 0;
      });

    // Delete notification
    builder
      .addCase(deleteNotification.fulfilled, (state, action: PayloadAction<string>) => {
        const index = state.notifications.findIndex((n) => n.id === action.payload);
        if (index !== -1) {
          const notification = state.notifications[index];
          if (!notification.read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          state.notifications.splice(index, 1);
          state.pagination.total = Math.max(0, state.pagination.total - 1);
        }
      });

    // Delete many notifications
    builder
      .addCase(deleteManyNotifications.fulfilled, (state, action: PayloadAction<string[]>) => {
        let unreadDeleted = 0;
        action.payload.forEach((id) => {
          const index = state.notifications.findIndex((n) => n.id === id);
          if (index !== -1) {
            if (!state.notifications[index].read) {
              unreadDeleted++;
            }
            state.notifications.splice(index, 1);
          }
        });
        state.unreadCount = Math.max(0, state.unreadCount - unreadDeleted);
        state.pagination.total = Math.max(0, state.pagination.total - action.payload.length);
      });

    // Delete all read
    builder
      .addCase(deleteAllReadNotifications.fulfilled, (state, action: PayloadAction<number>) => {
        state.notifications = state.notifications.filter((n) => !n.read);
        state.pagination.total = Math.max(0, state.pagination.total - action.payload);
      });
  },
});

// Export actions
export const {
  addNotification,
  setUnreadCount,
  dismissToast,
  clearToasts,
  clearError,
  resetNotifications,
} = notificationSlice.actions;

// Export reducer
export default notificationSlice.reducer;

// Selectors
export const selectNotifications = (state: { notifications: NotificationState }) =>
  state.notifications.notifications;

export const selectUnreadCount = (state: { notifications: NotificationState }) =>
  state.notifications.unreadCount;

export const selectNotificationStats = (state: { notifications: NotificationState }) =>
  state.notifications.stats;

export const selectNotificationPreferences = (state: { notifications: NotificationState }) =>
  state.notifications.preferences;

export const selectNotificationPagination = (state: { notifications: NotificationState }) =>
  state.notifications.pagination;

export const selectNotificationsLoading = (state: { notifications: NotificationState }) =>
  state.notifications.loading;

export const selectNotificationError = (state: { notifications: NotificationState }) =>
  state.notifications.error;

export const selectToasts = (state: { notifications: NotificationState }) =>
  state.notifications.toasts;
