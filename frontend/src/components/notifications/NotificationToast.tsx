/**
 * NotificationToast Component
 *
 * Toast notifications for real-time alerts.
 * Displays new notifications as they arrive via Socket.io.
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Box,
  Typography,
  Slide,
} from '@mui/material';
import type { SlideProps } from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import type { AppDispatch } from '../../store/index.js';
import {
  dismissToast,
  selectToasts,
  markNotificationAsRead,
} from '../../store/slices/notificationSlice.js';

// Slide transition
function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

// Get severity based on notification type
const getSeverity = (type: string): 'success' | 'info' | 'warning' | 'error' => {
  switch (type) {
    case 'activity_completed':
    case 'approval_approved':
      return 'success';
    case 'approval_rejected':
    case 'deadline_approaching':
      return 'error';
    case 'approval_required':
    case 'conflict_detected':
    case 'resource_overallocated':
      return 'warning';
    default:
      return 'info';
  }
};

export const NotificationToast: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const toasts = useSelector(selectToasts);

  // Auto-dismiss toasts after 6 seconds
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    toasts.forEach((toast) => {
      const age = Date.now() - toast.timestamp;
      const remainingTime = Math.max(0, 6000 - age);

      if (remainingTime > 0) {
        const timer = setTimeout(() => {
          dispatch(dismissToast(toast.id));
        }, remainingTime);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dispatch]);

  const handleClose = (toastId: string) => {
    dispatch(dismissToast(toastId));
  };

  const handleClick = (toastId: string, actionUrl?: string) => {
    // Mark as read
    dispatch(markNotificationAsRead(toastId));
    dispatch(dismissToast(toastId));

    // Navigate if action URL exists
    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  // Only show the most recent toast
  const currentToast = toasts[toasts.length - 1];

  if (!currentToast) {
    return null;
  }

  const { notification } = currentToast;
  const severity = getSeverity(notification.type);

  return (
    <Snackbar
      open={true}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      TransitionComponent={SlideTransition}
      sx={{ mt: 8 }}
    >
      <Alert
        severity={severity}
        variant="filled"
        sx={{
          width: '100%',
          maxWidth: 400,
          cursor: notification.actionUrl ? 'pointer' : 'default',
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
            {notification.actionUrl && (
              <IconButton
                size="small"
                color="inherit"
                onClick={() => handleClick(currentToast.id, notification.actionUrl)}
                aria-label="View details"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              size="small"
              color="inherit"
              onClick={() => handleClose(currentToast.id)}
              aria-label="Close"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        onClick={() => {
          if (notification.actionUrl) {
            handleClick(currentToast.id, notification.actionUrl);
          }
        }}
      >
        <AlertTitle sx={{ fontWeight: 'bold', mb: 0.5 }}>
          {notification.title}
        </AlertTitle>
        <Typography
          variant="body2"
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
      </Alert>
    </Snackbar>
  );
};

export default NotificationToast;
