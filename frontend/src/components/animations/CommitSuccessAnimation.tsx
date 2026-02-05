import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// ============================================
// Types
// ============================================

interface CommitSuccessAnimationProps {
  /** Whether to show the animation */
  show: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Custom message to display */
  message?: string;
  /** Auto-dismiss delay in milliseconds (0 to disable) */
  autoDismissDelay?: number;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
}

// ============================================
// Size configurations
// ============================================

const sizeConfig = {
  small: {
    iconSize: 48,
    fontSize: 'body1' as const,
    padding: 3,
  },
  medium: {
    iconSize: 64,
    fontSize: 'h6' as const,
    padding: 4,
  },
  large: {
    iconSize: 80,
    fontSize: 'h5' as const,
    padding: 5,
  },
};

// ============================================
// Component
// ============================================

const CommitSuccessAnimation: React.FC<CommitSuccessAnimationProps> = ({
  show,
  onComplete,
  message = 'Committed Successfully',
  autoDismissDelay = 1500,
  size = 'medium',
}) => {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const config = sizeConfig[size];

  useEffect(() => {
    if (show) {
      setVisible(true);
      setExiting(false);

      // Auto-dismiss after delay
      if (autoDismissDelay > 0) {
        const exitTimer = setTimeout(() => {
          setExiting(true);
          
          // Wait for exit animation to complete
          const completeTimer = setTimeout(() => {
            setVisible(false);
            onComplete?.();
          }, 200);

          return () => clearTimeout(completeTimer);
        }, autoDismissDelay);

        return () => clearTimeout(exitTimer);
      }
    } else {
      // If show becomes false externally, trigger exit
      if (visible) {
        setExiting(true);
        const timer = setTimeout(() => {
          setVisible(false);
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [show, autoDismissDelay, onComplete, visible]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: theme.zIndex.modal + 1,
        bgcolor: alpha(theme.palette.background.default, 0.8),
        backdropFilter: 'blur(4px)',
        animation: exiting 
          ? 'success-exit 200ms ease-in forwards' 
          : 'success-enter 300ms ease-out forwards',
        '@keyframes success-enter': {
          '0%': {
            opacity: 0,
          },
          '100%': {
            opacity: 1,
          },
        },
        '@keyframes success-exit': {
          '0%': {
            opacity: 1,
          },
          '100%': {
            opacity: 0,
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: config.padding,
          borderRadius: 4,
          bgcolor: theme.palette.background.paper,
          boxShadow: theme.shadows[8],
          animation: exiting 
            ? 'content-exit 200ms ease-in forwards' 
            : 'content-enter 300ms ease-out forwards',
          '@keyframes content-enter': {
            '0%': {
              transform: 'scale(0)',
              opacity: 0,
            },
            '50%': {
              transform: 'scale(1.05)',
            },
            '100%': {
              transform: 'scale(1)',
              opacity: 1,
            },
          },
          '@keyframes content-exit': {
            '0%': {
              transform: 'scale(1)',
              opacity: 1,
            },
            '100%': {
              transform: 'scale(0.9)',
              opacity: 0,
            },
          },
        }}
      >
        {/* Animated checkmark */}
        <Box
          sx={{
            position: 'relative',
            width: config.iconSize,
            height: config.iconSize,
            mb: 2,
          }}
        >
          {/* Pulse ring */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: config.iconSize,
              height: config.iconSize,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.success.main, 0.2),
              animation: 'pulse-ring 600ms ease-out',
              '@keyframes pulse-ring': {
                '0%': {
                  transform: 'translate(-50%, -50%) scale(0)',
                  opacity: 0.8,
                },
                '100%': {
                  transform: 'translate(-50%, -50%) scale(1.5)',
                  opacity: 0,
                },
              },
            }}
          />
          
          {/* Icon */}
          <CheckCircleIcon
            sx={{
              fontSize: config.iconSize,
              color: 'success.main',
              animation: 'icon-enter 400ms ease-out forwards',
              '@keyframes icon-enter': {
                '0%': {
                  transform: 'scale(0)',
                },
                '60%': {
                  transform: 'scale(1.1)',
                },
                '100%': {
                  transform: 'scale(1)',
                },
              },
            }}
          />
        </Box>

        {/* Message */}
        <Typography
          variant={config.fontSize}
          fontWeight={600}
          color="success.main"
          sx={{
            animation: 'text-enter 300ms ease-out 150ms forwards',
            opacity: 0,
            '@keyframes text-enter': {
              '0%': {
                opacity: 0,
                transform: 'translateY(8px)',
              },
              '100%': {
                opacity: 1,
                transform: 'translateY(0)',
              },
            },
          }}
        >
          {message}
        </Typography>
      </Box>
    </Box>
  );
};

// ============================================
// Inline Success Animation (for cards/buttons)
// ============================================

interface InlineSuccessAnimationProps {
  show: boolean;
  size?: number;
}

export const InlineSuccessAnimation: React.FC<InlineSuccessAnimationProps> = ({
  show,
  size = 24,
}) => {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 600);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'inline-success 600ms ease-out forwards',
        '@keyframes inline-success': {
          '0%': {
            transform: 'scale(0)',
            opacity: 0,
          },
          '30%': {
            transform: 'scale(1.2)',
            opacity: 1,
          },
          '60%': {
            transform: 'scale(1)',
            opacity: 1,
          },
          '100%': {
            transform: 'scale(1)',
            opacity: 0,
          },
        },
      }}
    >
      <CheckCircleIcon
        sx={{
          fontSize: size,
          color: theme.palette.success.main,
        }}
      />
    </Box>
  );
};

// ============================================
// Default Export
// ============================================

export default CommitSuccessAnimation;
