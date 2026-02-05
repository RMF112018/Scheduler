import React, { useState } from 'react';
import {
  Tooltip,
  TooltipProps,
  Box,
  Typography,
  IconButton,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Lightbulb as TipIcon,
  Help as HelpIcon,
  Close as CloseIcon,
  Keyboard as ShortcutIcon,
} from '@mui/icons-material';
import { getShortcutDisplay } from '@hooks/useKeyboardShortcuts';

// ============================================
// Types
// ============================================

interface SmartTooltipProps extends Omit<TooltipProps, 'title'> {
  /** Main tooltip text */
  title: string;
  /** Optional longer description */
  description?: string;
  /** Optional keyboard shortcut */
  shortcut?: string;
  /** Optional tip text */
  tip?: string;
  /** Whether this is a help tooltip (shows ? icon) */
  isHelp?: boolean;
  /** Whether user can dismiss this tooltip permanently */
  dismissible?: boolean;
  /** Key for storing dismissal in localStorage */
  dismissKey?: string;
  /** Variant affects styling */
  variant?: 'default' | 'info' | 'tip' | 'warning';
}

// ============================================
// Component
// ============================================

const SmartTooltip: React.FC<SmartTooltipProps> = ({
  title,
  description,
  shortcut,
  tip,
  isHelp = false,
  dismissible = false,
  dismissKey,
  variant = 'default',
  children,
  ...tooltipProps
}) => {
  const theme = useTheme();
  
  // Check if dismissed
  const [isDismissed, setIsDismissed] = useState(() => {
    if (!dismissible || !dismissKey) return false;
    return localStorage.getItem(`tooltip-dismissed-${dismissKey}`) === 'true';
  });

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dismissKey) {
      localStorage.setItem(`tooltip-dismissed-${dismissKey}`, 'true');
    }
    setIsDismissed(true);
  };

  // Don't show if dismissed
  if (isDismissed) {
    return <>{children}</>;
  }

  // Variant colors
  const variantColors = {
    default: {
      bg: theme.palette.grey[800],
      border: 'transparent',
      icon: null,
    },
    info: {
      bg: theme.palette.info.dark,
      border: theme.palette.info.main,
      icon: <HelpIcon fontSize="small" />,
    },
    tip: {
      bg: alpha(theme.palette.warning.dark, 0.95),
      border: theme.palette.warning.main,
      icon: <TipIcon fontSize="small" sx={{ color: 'warning.light' }} />,
    },
    warning: {
      bg: theme.palette.warning.dark,
      border: theme.palette.warning.main,
      icon: null,
    },
  };

  const colors = variantColors[variant];

  // Build tooltip content
  const tooltipContent = (
    <Box sx={{ maxWidth: 280 }}>
      {/* Header with optional dismiss */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {colors.icon}
          <Typography variant="body2" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        {dismissible && (
          <IconButton
            size="small"
            onClick={handleDismiss}
            sx={{
              p: 0.25,
              color: 'inherit',
              opacity: 0.7,
              '&:hover': { opacity: 1 },
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>

      {/* Description */}
      {description && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            opacity: 0.9,
            lineHeight: 1.4,
          }}
        >
          {description}
        </Typography>
      )}

      {/* Shortcut */}
      {shortcut && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <ShortcutIcon sx={{ fontSize: 14, opacity: 0.7 }} />
          <Chip
            label={getShortcutDisplay(shortcut)}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.7rem',
              bgcolor: alpha('#fff', 0.15),
              color: 'inherit',
            }}
          />
        </Box>
      )}

      {/* Tip */}
      {tip && (
        <Box
          sx={{
            mt: 1,
            pt: 1,
            borderTop: '1px solid',
            borderColor: alpha('#fff', 0.2),
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0.5,
          }}
        >
          <TipIcon sx={{ fontSize: 14, color: 'warning.light', mt: 0.25 }} />
          <Typography
            variant="caption"
            sx={{ opacity: 0.9, fontStyle: 'italic' }}
          >
            {tip}
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Tooltip
      {...tooltipProps}
      title={tooltipContent}
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: colors.bg,
            border: colors.border !== 'transparent' ? `1px solid ${colors.border}` : 'none',
            p: 1.5,
            borderRadius: 2,
            boxShadow: theme.shadows[8],
            '& .MuiTooltip-arrow': {
              color: colors.bg,
            },
          },
        },
        ...tooltipProps.componentsProps,
      }}
    >
      {isHelp ? (
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'help',
          }}
        >
          {children}
          <HelpIcon
            sx={{
              fontSize: 16,
              ml: 0.5,
              color: 'text.secondary',
              opacity: 0.6,
            }}
          />
        </Box>
      ) : (
        children
      )}
    </Tooltip>
  );
};

// ============================================
// Preset Tooltips
// ============================================

interface PresetTooltipProps {
  children: React.ReactElement;
}

export const OneTapTooltip: React.FC<PresetTooltipProps> = ({ children }) => (
  <SmartTooltip
    title="One-Tap Status"
    description="Tap the card to cycle through statuses: Not Set → Should Do → Will Do"
    tip="Saves time vs opening the full editor"
    variant="tip"
    placement="top"
    dismissible
    dismissKey="one-tap-hint"
  >
    {children}
  </SmartTooltip>
);

export const SwipeTooltip: React.FC<PresetTooltipProps> = ({ children }) => (
  <SmartTooltip
    title="Swipe to Approve"
    description="Swipe right to approve, left to reject. Or tap to view details."
    variant="tip"
    placement="top"
    dismissible
    dismissKey="swipe-hint"
  >
    {children}
  </SmartTooltip>
);

export const ShortcutTooltip: React.FC<PresetTooltipProps & { shortcut: string; action: string }> = ({
  children,
  shortcut,
  action,
}) => (
  <SmartTooltip
    title={action}
    shortcut={shortcut}
    variant="default"
    placement="bottom"
  >
    {children}
  </SmartTooltip>
);

// ============================================
// Default Export
// ============================================

export default SmartTooltip;
