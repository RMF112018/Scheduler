/**
 * OfflineBanner Component
 *
 * A dismissible banner that appears when the user is offline.
 * Provides clear feedback about offline status and what functionality is available.
 */

import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Collapse,
  IconButton,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  CloudOff as OfflineIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useOfflineSync } from '@hooks/useOfflineSync';

export interface OfflineBannerProps {
  position?: 'top' | 'bottom';
  showPendingCount?: boolean;
  dismissible?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  position = 'top',
  showPendingCount = true,
  dismissible = true,
}) => {
  const { isOnline, isSyncing, pendingSyncCount, syncNow } = useOfflineSync();
  const [dismissed, setDismissed] = useState(false);
  const [showSyncingBanner, setShowSyncingBanner] = useState(false);

  // Reset dismissed state when going offline
  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  // Show syncing banner briefly when coming back online
  useEffect(() => {
    if (isOnline && pendingSyncCount > 0) {
      setShowSyncingBanner(true);
      syncNow();
    }
  }, [isOnline, pendingSyncCount, syncNow]);

  // Hide syncing banner after sync completes
  useEffect(() => {
    if (!isSyncing && showSyncingBanner) {
      const timer = setTimeout(() => {
        setShowSyncingBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, showSyncingBanner]);

  // Don't show anything if online and no syncing
  if (isOnline && !showSyncingBanner) {
    return null;
  }

  // Show syncing progress banner
  if (isOnline && showSyncingBanner) {
    return (
      <Collapse in={!dismissed}>
        <Alert
          severity="info"
          icon={<SyncIcon />}
          sx={{
            borderRadius: 0,
            position: position === 'top' ? 'sticky' : 'fixed',
            top: position === 'top' ? 0 : undefined,
            bottom: position === 'bottom' ? 0 : undefined,
            left: 0,
            right: 0,
            zIndex: 1200,
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2">
              {isSyncing
                ? `Syncing ${pendingSyncCount} change${pendingSyncCount > 1 ? 's' : ''}...`
                : 'All changes synced!'}
            </Typography>
            {isSyncing && (
              <Box sx={{ width: 100 }}>
                <LinearProgress />
              </Box>
            )}
          </Box>
        </Alert>
      </Collapse>
    );
  }

  // Show offline banner
  return (
    <Collapse in={!dismissed}>
      <Alert
        severity="warning"
        icon={<OfflineIcon />}
        action={
          dismissible && (
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setDismissed(true)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          )
        }
        sx={{
          borderRadius: 0,
          position: position === 'top' ? 'sticky' : 'fixed',
          top: position === 'top' ? 0 : undefined,
          bottom: position === 'bottom' ? 0 : undefined,
          left: 0,
          right: 0,
          zIndex: 1200,
        }}
      >
        <AlertTitle>You're offline</AlertTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Typography variant="body2">
            Don't worry - your changes are being saved locally and will sync when you're back online.
            {showPendingCount && pendingSyncCount > 0 && (
              <strong>
                {' '}
                ({pendingSyncCount} change{pendingSyncCount > 1 ? 's' : ''} pending)
              </strong>
            )}
          </Typography>
        </Box>
      </Alert>
    </Collapse>
  );
};

export default OfflineBanner;
