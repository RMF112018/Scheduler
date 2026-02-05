/**
 * ConnectionStatus Component
 *
 * Shows real-time connection status indicator.
 * Displays when connected/disconnected from Socket.io.
 */

import React from 'react';
import {
  Chip,
  Tooltip,
  Box,
} from '@mui/material';
import {
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useSocket } from '../../hooks/useSocket.js';

interface ConnectionStatusProps {
  variant?: 'chip' | 'icon' | 'text';
  showWhenConnected?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  variant = 'chip',
  showWhenConnected = false,
}) => {
  const { isConnected } = useSocket({ autoConnect: false });

  // Don't show anything if connected and showWhenConnected is false
  if (isConnected && !showWhenConnected) {
    return null;
  }

  if (variant === 'icon') {
    return (
      <Tooltip title={isConnected ? 'Connected' : 'Disconnected - Reconnecting...'}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: isConnected ? 'success.main' : 'error.main',
          }}
        >
          {isConnected ? (
            <WifiIcon fontSize="small" />
          ) : (
            <WifiOffIcon fontSize="small" />
          )}
        </Box>
      </Tooltip>
    );
  }

  if (variant === 'text') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          color: isConnected ? 'success.main' : 'error.main',
        }}
      >
        {isConnected ? (
          <>
            <WifiIcon fontSize="small" />
            <span>Connected</span>
          </>
        ) : (
          <>
            <SyncIcon fontSize="small" className="rotating" />
            <span>Reconnecting...</span>
          </>
        )}
      </Box>
    );
  }

  // Default: chip variant
  return (
    <Chip
      icon={isConnected ? <WifiIcon /> : <SyncIcon className="rotating" />}
      label={isConnected ? 'Connected' : 'Reconnecting...'}
      color={isConnected ? 'success' : 'warning'}
      size="small"
      variant="outlined"
      sx={{
        '& .rotating': {
          animation: 'spin 1s linear infinite',
        },
        '@keyframes spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      }}
    />
  );
};

export default ConnectionStatus;
