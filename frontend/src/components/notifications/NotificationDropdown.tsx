/**
 * NotificationDropdown Component
 *
 * Dropdown menu showing recent notifications with:
 * - Unread count badge
 * - Notification list with actions
 * - Mark all as read
 * - Link to full notifications page
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Button,
  Tooltip,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import type { AppDispatch, RootState } from '../../store/index.js';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  selectNotifications,
  selectUnreadCount,
  selectNotificationsLoading,
} from '../../store/slices/notificationSlice.js';
import type { Notification } from '../../services/api/notificationApi.js';

// Notification type to icon mapping
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'schedule_updated':
      return <ScheduleIcon color="primary" />;
    case 'activity_completed':
      return <CheckCircleIcon color="success" />;
    case 'approval_required':
      return <AssignmentIcon color="warning" />;
    case 'approval_approved':
      return <CheckCircleIcon color="success" />;
    case 'approval_rejected':
      return <ErrorIcon color="error" />;
    case 'conflict_detected':
      return <WarningIcon color="warning" />;
    case 'deadline_approaching':
      return <WarningIcon color="error" />;
    case 'resource_overallocated':
      return <WarningIcon color="warning" />;
    case 'mention':
      return <PersonIcon color="primary" />;
    case 'system_alert':
      return <InfoIcon color="info" />;
    default:
      return <NotificationsIcon color="action" />;
  }
};

// Notification type to color mapping
const getNotificationColor = (type: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (type) {
    case 'approval_required':
    case 'conflict_detected':
    case 'resource_overallocated':
      return 'warning';
    case 'approval_rejected':
    case 'deadline_approaching':
      return 'error';
    case 'activity_completed':
    case 'approval_approved':
      return 'success';
    case 'schedule_updated':
    case 'mention':
      return 'primary';
    default:
      return 'default';
  }
};

export const NotificationDropdown: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading = useSelector(selectNotificationsLoading);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  const open = Boolean(anchorEl);

  // Fetch notifications and unread count on mount
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchUnreadCount());
    }
  }, [dispatch, isAuthenticated]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open && isAuthenticated) {
      dispatch(fetchNotifications({ limit: 10 }));
    }
  }, [open, dispatch, isAuthenticated]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      dispatch(markNotificationAsRead(notification.id));
    }

    // Navigate to action URL if present
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      handleClose();
    }
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllNotificationsAsRead());
  };

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    dispatch(deleteNotification(notificationId));
  };

  const handleViewAll = () => {
    navigate('/notifications');
    handleClose();
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          color="inherit"
          onClick={handleClick}
          aria-label={`${unreadCount} unread notifications`}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            {unreadCount > 0 ? (
              <NotificationsActiveIcon />
            ) : (
              <NotificationsIcon />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6">Notifications</Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<MarkEmailReadIcon />}
              onClick={handleMarkAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* Notification List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No notifications</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 350, overflow: 'auto' }}>
            {notifications.slice(0, 10).map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    bgcolor: notification.read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      bgcolor: 'action.selected',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getNotificationIcon(notification.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: notification.read ? 'normal' : 'bold',
                            flex: 1,
                          }}
                        >
                          {notification.title}
                        </Typography>
                        <Chip
                          label={notification.type.replace(/_/g, ' ')}
                          size="small"
                          color={getNotificationColor(notification.type)}
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Delete">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < notifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Footer */}
        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            endIcon={<OpenInNewIcon />}
            onClick={handleViewAll}
          >
            View all notifications
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationDropdown;
