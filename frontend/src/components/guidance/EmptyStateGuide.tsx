import React from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Inbox as EmptyIcon,
  Add as AddIcon,
  Upload as ImportIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

// ============================================
// Types
// ============================================

type EmptyStateVariant = 
  | 'no-data'
  | 'no-results'
  | 'no-matches'
  | 'error'
  | 'success';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'text' | 'outlined' | 'contained';
  icon?: React.ReactNode;
}

interface EmptyStateGuideProps {
  /** Variant determines the icon and default message */
  variant?: EmptyStateVariant;
  /** Custom icon (overrides variant icon) */
  icon?: React.ReactNode;
  /** Main title */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  primaryAction?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Whether this is a compact inline version */
  compact?: boolean;
  /** Custom illustration or image */
  illustration?: React.ReactNode;
}

// ============================================
// Variant Configuration
// ============================================

const variantConfig: Record<EmptyStateVariant, {
  icon: React.ReactNode;
  color: string;
}> = {
  'no-data': {
    icon: <EmptyIcon sx={{ fontSize: 64 }} />,
    color: 'text.secondary',
  },
  'no-results': {
    icon: <SearchIcon sx={{ fontSize: 64 }} />,
    color: 'text.secondary',
  },
  'no-matches': {
    icon: <FilterIcon sx={{ fontSize: 64 }} />,
    color: 'info.main',
  },
  'error': {
    icon: <EmptyIcon sx={{ fontSize: 64 }} />,
    color: 'error.main',
  },
  'success': {
    icon: <EmptyIcon sx={{ fontSize: 64 }} />,
    color: 'success.main',
  },
};

// ============================================
// Component
// ============================================

const EmptyStateGuide: React.FC<EmptyStateGuideProps> = ({
  variant = 'no-data',
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
  illustration,
}) => {
  const theme = useTheme();
  const config = variantConfig[variant];
  const displayIcon = icon || config.icon;

  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.grey[500], 0.08),
        }}
      >
        <Box sx={{ color: config.color, opacity: 0.6 }}>
          {React.cloneElement(displayIcon as React.ReactElement, {
            sx: { fontSize: 32 },
          })}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            {title}
          </Typography>
          {description && (
            <Typography variant="caption" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
        {primaryAction && (
          <Button
            size="small"
            variant={primaryAction.variant || 'outlined'}
            onClick={primaryAction.onClick}
            startIcon={primaryAction.icon}
          >
            {primaryAction.label}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        textAlign: 'center',
      }}
    >
      {/* Illustration or Icon */}
      {illustration || (
        <Box
          sx={{
            color: config.color,
            opacity: 0.5,
            mb: 3,
          }}
        >
          {displayIcon}
        </Box>
      )}

      {/* Title */}
      <Typography
        variant="h6"
        color="text.secondary"
        gutterBottom
        sx={{ fontWeight: 600 }}
      >
        {title}
      </Typography>

      {/* Description */}
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3, maxWidth: 360 }}
        >
          {description}
        </Typography>
      )}

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {primaryAction && (
            <Button
              variant={primaryAction.variant || 'contained'}
              onClick={primaryAction.onClick}
              startIcon={primaryAction.icon}
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant || 'outlined'}
              onClick={secondaryAction.onClick}
              startIcon={secondaryAction.icon}
            >
              {secondaryAction.label}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

// ============================================
// Preset Empty States
// ============================================

interface PresetEmptyStateProps {
  onAction?: () => void;
  onSecondaryAction?: () => void;
}

export const NoSchedulesEmpty: React.FC<PresetEmptyStateProps> = ({
  onAction,
  onSecondaryAction,
}) => (
  <EmptyStateGuide
    variant="no-data"
    title="No schedules yet"
    description="Get started by creating a new schedule or importing from P6/Excel"
    primaryAction={
      onAction
        ? { label: 'Create Schedule', onClick: onAction, icon: <AddIcon /> }
        : undefined
    }
    secondaryAction={
      onSecondaryAction
        ? { label: 'Import', onClick: onSecondaryAction, icon: <ImportIcon /> }
        : undefined
    }
  />
);

export const NoActivitiesEmpty: React.FC<PresetEmptyStateProps> = ({
  onAction,
}) => (
  <EmptyStateGuide
    variant="no-data"
    title="No activities in this schedule"
    description="Add activities manually or import from a file"
    primaryAction={
      onAction
        ? { label: 'Add Activity', onClick: onAction, icon: <AddIcon /> }
        : undefined
    }
  />
);

export const NoSearchResultsEmpty: React.FC<PresetEmptyStateProps> = ({
  onAction,
}) => (
  <EmptyStateGuide
    variant="no-results"
    title="No results found"
    description="Try adjusting your search terms or filters"
    primaryAction={
      onAction
        ? { label: 'Clear Search', onClick: onAction, variant: 'outlined' }
        : undefined
    }
  />
);

export const NoFilterMatchesEmpty: React.FC<PresetEmptyStateProps> = ({
  onAction,
}) => (
  <EmptyStateGuide
    variant="no-matches"
    title="No items match your filters"
    description="Try adjusting or clearing your filters"
    primaryAction={
      onAction
        ? { label: 'Clear Filters', onClick: onAction, icon: <FilterIcon />, variant: 'outlined' }
        : undefined
    }
  />
);

export const ErrorEmpty: React.FC<PresetEmptyStateProps & { message?: string }> = ({
  onAction,
  message,
}) => (
  <EmptyStateGuide
    variant="error"
    title="Something went wrong"
    description={message || 'Unable to load data. Please try again.'}
    primaryAction={
      onAction
        ? { label: 'Retry', onClick: onAction, icon: <RefreshIcon /> }
        : undefined
    }
  />
);

export const AllCaughtUpEmpty: React.FC = () => (
  <EmptyStateGuide
    variant="success"
    title="All caught up!"
    description="No pending items at this time"
  />
);

// ============================================
// Default Export
// ============================================

export default EmptyStateGuide;
