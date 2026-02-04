import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  Tooltip,
  Badge,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  TrendingDown as FloatIcon,
  People as ResourceIcon,
  Link as LinkIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { Conflict, LookaheadActivity } from '@store/slices/lookaheadSlice';

// Props interface
interface ConflictAlertPanelProps {
  conflicts: Conflict[];
  activities?: LookaheadActivity[];
  onActivityClick?: (activityId: string) => void;
  onRefresh?: () => void;
  onDismiss?: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  variant?: 'banner' | 'panel' | 'compact';
}

// Conflict type configuration
const conflictTypeConfig: Record<
  string,
  { label: string; icon: React.ReactNode; description: string }
> = {
  zero_float_violation: {
    label: 'Zero Float',
    icon: <FloatIcon />,
    description: 'Critical path activity delayed',
  },
  resource_conflict: {
    label: 'Resource Conflict',
    icon: <ResourceIcon />,
    description: 'Resource scheduling conflict',
  },
  resource_over_allocation: {
    label: 'Over-Allocation',
    icon: <ResourceIcon />,
    description: 'Resource assigned beyond capacity',
  },
  predecessor_conflict: {
    label: 'Predecessor',
    icon: <LinkIcon />,
    description: 'Activity starts before predecessor finishes',
  },
  predecessor_violation: {
    label: 'Predecessor',
    icon: <LinkIcon />,
    description: 'Predecessor logic violation',
  },
  date_conflict: {
    label: 'Date Conflict',
    icon: <ScheduleIcon />,
    description: 'Schedule date inconsistency',
  },
  out_of_sequence_risk: {
    label: 'OOS Risk',
    icon: <TimelineIcon />,
    description: 'Risk of out-of-sequence execution',
  },
  near_critical_path: {
    label: 'Near Critical',
    icon: <WarningIcon />,
    description: 'Activity approaching critical path',
  },
};

// Severity configuration
const severityConfig: Record<
  'high' | 'medium' | 'low',
  { color: 'error' | 'warning' | 'info'; icon: React.ReactNode; label: string }
> = {
  high: { color: 'error', icon: <ErrorIcon />, label: 'Critical' },
  medium: { color: 'warning', icon: <WarningIcon />, label: 'Warning' },
  low: { color: 'info', icon: <InfoIcon />, label: 'Info' },
};

const ConflictAlertPanel: React.FC<ConflictAlertPanelProps> = ({
  conflicts,
  activities = [],
  onActivityClick,
  onRefresh,
  onDismiss,
  collapsible = true,
  defaultExpanded = true,
  variant = 'panel',
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['high']);

  // Group conflicts by severity
  const groupedBySeverity = useMemo(() => {
    const groups: Record<'high' | 'medium' | 'low', Conflict[]> = {
      high: [],
      medium: [],
      low: [],
    };

    conflicts.forEach((conflict) => {
      groups[conflict.severity].push(conflict);
    });

    return groups;
  }, [conflicts]);

  // Group conflicts by type
  const groupedByType = useMemo(() => {
    const groups: Record<string, Conflict[]> = {};

    conflicts.forEach((conflict) => {
      if (!groups[conflict.type]) {
        groups[conflict.type] = [];
      }
      groups[conflict.type].push(conflict);
    });

    return groups;
  }, [conflicts]);

  // Get unique affected activities
  const affectedActivities = useMemo(() => {
    const activityIds = new Set(conflicts.map((c) => c.activityId));
    return activities.filter((a) => activityIds.has(a.id));
  }, [conflicts, activities]);

  // Handle accordion expand
  const handleAccordionChange = (group: string) => {
    setExpandedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  // No conflicts state
  if (conflicts.length === 0) {
    if (variant === 'compact') return null;

    return (
      <Alert
        severity="success"
        icon={<CheckIcon />}
        sx={{ borderRadius: 2 }}
        action={
          onRefresh && (
            <IconButton size="small" onClick={onRefresh}>
              <RefreshIcon />
            </IconButton>
          )
        }
      >
        <AlertTitle>No Conflicts Detected</AlertTitle>
        All activities are properly scheduled with no conflicts.
      </Alert>
    );
  }

  // Render conflict item
  const renderConflictItem = (conflict: Conflict, index: number) => {
    const typeConfig = conflictTypeConfig[conflict.type] || {
      label: conflict.type,
      icon: <WarningIcon />,
      description: '',
    };
    const sevConfig = severityConfig[conflict.severity];

    return (
      <ListItem
        key={`${conflict.activityId}-${conflict.type}-${index}`}
        sx={{
          bgcolor: alpha(theme.palette[sevConfig.color].main, 0.05),
          borderRadius: 1,
          mb: 0.5,
          border: '1px solid',
          borderColor: alpha(theme.palette[sevConfig.color].main, 0.2),
          '&:hover': {
            bgcolor: alpha(theme.palette[sevConfig.color].main, 0.1),
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Tooltip title={typeConfig.label}>
            <Box sx={{ color: `${sevConfig.color}.main` }}>{typeConfig.icon}</Box>
          </Tooltip>
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography variant="body2" fontWeight={500}>
              {conflict.activityName}
            </Typography>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {conflict.message}
            </Typography>
          }
        />
        {onActivityClick && (
          <ListItemSecondaryAction>
            <Tooltip title="View Activity">
              <IconButton
                size="small"
                onClick={() => onActivityClick(conflict.activityId)}
              >
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItemSecondaryAction>
        )}
      </ListItem>
    );
  };

  // Compact variant (just a badge/chip)
  if (variant === 'compact') {
    const highCount = groupedBySeverity.high.length;
    const mediumCount = groupedBySeverity.medium.length;

    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {highCount > 0 && (
          <Chip
            icon={<ErrorIcon />}
            label={`${highCount} Critical`}
            size="small"
            color="error"
            onClick={() => setExpanded(!expanded)}
          />
        )}
        {mediumCount > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${mediumCount} Warnings`}
            size="small"
            color="warning"
            onClick={() => setExpanded(!expanded)}
          />
        )}
      </Box>
    );
  }

  // Banner variant (collapsible alert)
  if (variant === 'banner') {
    const highCount = groupedBySeverity.high.length;
    const severity = highCount > 0 ? 'error' : 'warning';

    return (
      <Alert
        severity={severity}
        sx={{ borderRadius: 2, mb: 2 }}
        action={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {onRefresh && (
              <IconButton size="small" onClick={onRefresh}>
                <RefreshIcon />
              </IconButton>
            )}
            {collapsible && (
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
            {onDismiss && (
              <IconButton size="small" onClick={onDismiss}>
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        }
      >
        <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {groupedBySeverity.high.length > 0 && (
              <Chip
                label={`${groupedBySeverity.high.length} Critical`}
                size="small"
                color="error"
              />
            )}
            {groupedBySeverity.medium.length > 0 && (
              <Chip
                label={`${groupedBySeverity.medium.length} Warnings`}
                size="small"
                color="warning"
              />
            )}
          </Box>
        </AlertTitle>

        <Collapse in={expanded}>
          <Box sx={{ mt: 1 }}>
            <List dense disablePadding>
              {conflicts.slice(0, 5).map((conflict, index) =>
                renderConflictItem(conflict, index)
              )}
            </List>
            {conflicts.length > 5 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                +{conflicts.length - 5} more conflicts
              </Typography>
            )}
          </Box>
        </Collapse>
      </Alert>
    );
  }

  // Full panel variant
  return (
    <Paper
      elevation={2}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: groupedBySeverity.high.length > 0 ? 'error.main' : 'warning.main',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: alpha(
            groupedBySeverity.high.length > 0
              ? theme.palette.error.main
              : theme.palette.warning.main,
            0.1
          ),
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={conflicts.length} color="error">
            <WarningIcon
              color={groupedBySeverity.high.length > 0 ? 'error' : 'warning'}
            />
          </Badge>
          <Typography variant="h6" fontWeight={600}>
            Conflicts
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={onRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
          {collapsible && (
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
          {onDismiss && (
            <IconButton size="small" onClick={onDismiss}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Summary chips */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          p: 1.5,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        {groupedBySeverity.high.length > 0 && (
          <Chip
            icon={<ErrorIcon />}
            label={`${groupedBySeverity.high.length} Critical`}
            size="small"
            color="error"
            variant={expandedGroups.includes('high') ? 'filled' : 'outlined'}
            onClick={() => handleAccordionChange('high')}
          />
        )}
        {groupedBySeverity.medium.length > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${groupedBySeverity.medium.length} Warnings`}
            size="small"
            color="warning"
            variant={expandedGroups.includes('medium') ? 'filled' : 'outlined'}
            onClick={() => handleAccordionChange('medium')}
          />
        )}
        {groupedBySeverity.low.length > 0 && (
          <Chip
            icon={<InfoIcon />}
            label={`${groupedBySeverity.low.length} Info`}
            size="small"
            color="info"
            variant={expandedGroups.includes('low') ? 'filled' : 'outlined'}
            onClick={() => handleAccordionChange('low')}
          />
        )}
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {affectedActivities.length} activities affected
        </Typography>
      </Box>

      {/* Conflict list */}
      <Collapse in={expanded}>
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {(['high', 'medium', 'low'] as const).map((severity) => {
            const severityConflicts = groupedBySeverity[severity];
            if (severityConflicts.length === 0) return null;

            const config = severityConfig[severity];

            return (
              <Accordion
                key={severity}
                expanded={expandedGroups.includes(severity)}
                onChange={() => handleAccordionChange(severity)}
                disableGutters
                elevation={0}
                sx={{
                  '&:before': { display: 'none' },
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    bgcolor: alpha(theme.palette[config.color].main, 0.05),
                    '&:hover': {
                      bgcolor: alpha(theme.palette[config.color].main, 0.1),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: `${config.color}.main` }}>{config.icon}</Box>
                    <Typography fontWeight={500}>{config.label}</Typography>
                    <Chip
                      label={severityConflicts.length}
                      size="small"
                      color={config.color}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 1 }}>
                  <List dense disablePadding>
                    {severityConflicts.map((conflict, index) =>
                      renderConflictItem(conflict, index)
                    )}
                  </List>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>

        {/* Conflict types summary */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'grey.50',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            By Type
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.entries(groupedByType).map(([type, typeConflicts]) => {
              const config = conflictTypeConfig[type] || {
                label: type,
                icon: <WarningIcon />,
              };
              return (
                <Tooltip key={type} title={config.description || ''}>
                  <Chip
                    icon={config.icon as React.ReactElement}
                    label={`${config.label} (${typeConflicts.length})`}
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ConflictAlertPanel;
