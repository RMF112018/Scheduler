/**
 * OfflineSyncIndicator Component
 *
 * Visual indicator showing offline/online status and sync state.
 * Features:
 * - Online/offline status badge
 * - Pending sync count
 * - Conflict count with warning
 * - Last sync time
 * - Manual sync button
 * - Expandable details panel
 */

import React, { useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  Popover,
  Typography,
  Button,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
} from '@mui/material';
import {
  CloudOff as OfflineIcon,
  CloudDone as OnlineIcon,
  Sync as SyncIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  CloudSync as CloudSyncIcon,
} from '@mui/icons-material';
import { useOfflineSync } from '@hooks/useOfflineSync';

export interface OfflineSyncIndicatorProps {
  variant?: 'chip' | 'icon' | 'full';
  showDetails?: boolean;
  onConflictsClick?: () => void;
}

export const OfflineSyncIndicator: React.FC<OfflineSyncIndicatorProps> = ({
  variant = 'chip',
  showDetails = true,
  onConflictsClick,
}) => {
  const {
    isOnline,
    isSyncing,
    pendingSyncCount,
    unresolvedConflicts,
    lastSyncAt,
    syncNow,
  } = useOfflineSync();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (showDetails) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSync = async () => {
    await syncNow();
  };

  const open = Boolean(anchorEl);

  // Determine status
  const hasIssues = unresolvedConflicts > 0;
  const hasPending = pendingSyncCount > 0;

  // Format last sync time
  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const lastSyncFormatted = lastSyncAt ? formatTimeAgo(lastSyncAt) : 'Never';

  // Render based on variant
  const renderIndicator = () => {
    if (variant === 'icon') {
      return (
        <Tooltip title={isOnline ? 'Online' : 'Offline'}>
          <IconButton
            onClick={handleClick}
            size="small"
            sx={{
              color: isOnline ? 'success.main' : 'error.main',
            }}
          >
            <Badge
              badgeContent={hasPending ? pendingSyncCount : 0}
              color="warning"
              max={99}
            >
              {isSyncing ? (
                <CloudSyncIcon />
              ) : isOnline ? (
                <OnlineIcon />
              ) : (
                <OfflineIcon />
              )}
            </Badge>
          </IconButton>
        </Tooltip>
      );
    }

    if (variant === 'full') {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            borderRadius: 1,
            bgcolor: isOnline ? 'success.light' : 'error.light',
            color: isOnline ? 'success.contrastText' : 'error.contrastText',
          }}
        >
          {isSyncing ? <CloudSyncIcon /> : isOnline ? <OnlineIcon /> : <OfflineIcon />}
          <Typography variant="body2" fontWeight="medium">
            {isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}
          </Typography>
          {hasPending && (
            <Chip
              size="small"
              label={`${pendingSyncCount} pending`}
              color="warning"
              sx={{ ml: 1 }}
            />
          )}
          {hasIssues && (
            <Chip
              size="small"
              icon={<WarningIcon />}
              label={`${unresolvedConflicts} conflicts`}
              color="error"
              onClick={onConflictsClick}
              sx={{ ml: 1 }}
            />
          )}
        </Box>
      );
    }

    // Default: chip variant
    return (
      <Chip
        icon={
          isSyncing ? (
            <CloudSyncIcon />
          ) : isOnline ? (
            <OnlineIcon />
          ) : (
            <OfflineIcon />
          )
        }
        label={
          isSyncing
            ? 'Syncing...'
            : hasPending
              ? `${pendingSyncCount} pending`
              : isOnline
                ? 'Online'
                : 'Offline'
        }
        color={hasIssues ? 'error' : isOnline ? 'success' : 'default'}
        variant={isOnline ? 'filled' : 'outlined'}
        onClick={handleClick}
        sx={{ cursor: showDetails ? 'pointer' : 'default' }}
      />
    );
  };

  return (
    <>
      {renderIndicator()}

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
      >
        <Box sx={{ p: 2, minWidth: 280, maxWidth: 360 }}>
          <Typography variant="h6" gutterBottom>
            Sync Status
          </Typography>

          {isSyncing && <LinearProgress sx={{ mb: 2 }} />}

          <List dense disablePadding>
            {/* Connection Status */}
            <ListItem>
              <ListItemIcon>
                {isOnline ? (
                  <CheckIcon color="success" />
                ) : (
                  <ErrorIcon color="error" />
                )}
              </ListItemIcon>
              <ListItemText
                primary="Connection"
                secondary={isOnline ? 'Connected to server' : 'Working offline'}
              />
            </ListItem>

            {/* Pending Changes */}
            <ListItem>
              <ListItemIcon>
                {hasPending ? (
                  <WarningIcon color="warning" />
                ) : (
                  <CheckIcon color="success" />
                )}
              </ListItemIcon>
              <ListItemText
                primary="Pending Changes"
                secondary={
                  hasPending
                    ? `${pendingSyncCount} change${pendingSyncCount > 1 ? 's' : ''} waiting to sync`
                    : 'All changes synced'
                }
              />
            </ListItem>

            {/* Conflicts */}
            {hasIssues && (
              <ListItem
                button
                onClick={() => {
                  handleClose();
                  onConflictsClick?.();
                }}
              >
                <ListItemIcon>
                  <ErrorIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Conflicts"
                  secondary={`${unresolvedConflicts} conflict${unresolvedConflicts > 1 ? 's' : ''} need resolution`}
                />
              </ListItem>
            )}

            {/* Last Sync */}
            <ListItem>
              <ListItemIcon>
                <ScheduleIcon color="action" />
              </ListItemIcon>
              <ListItemText primary="Last Synced" secondary={lastSyncFormatted} />
            </ListItem>
          </List>

          <Divider sx={{ my: 2 }} />

          {/* Offline Mode Alert */}
          {!isOnline && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You're working offline. Changes will be saved locally and synced when you're back
              online.
            </Alert>
          )}

          {/* Conflict Alert */}
          {hasIssues && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Some changes conflict with server data. Please resolve conflicts to continue syncing.
            </Alert>
          )}

          {/* Sync Button */}
          <Button
            variant="contained"
            fullWidth
            startIcon={<SyncIcon />}
            onClick={handleSync}
            disabled={!isOnline || isSyncing || pendingSyncCount === 0}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default OfflineSyncIndicator;
