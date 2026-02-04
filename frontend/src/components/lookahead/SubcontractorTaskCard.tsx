import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  Chip,
  IconButton,
  Collapse,
  LinearProgress,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
  Divider,
  Badge,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Timer as TimerIcon,
  AttachFile as AttachIcon,
  Comment as CommentIcon,
  Flag as FlagIcon,
  PlayArrow as StartIcon,
  Done as DoneIcon,
} from '@mui/icons-material';
import type { LookaheadActivity } from '@store/slices/lookaheadSlice';

// Props interface
interface SubcontractorTaskCardProps {
  activity: LookaheadActivity;
  onStatusChange: (activityId: string, status: 'should_do' | 'will_do') => void;
  onViewDetails?: (activityId: string) => void;
  onAddAttachment?: (activityId: string) => void;
  onAddComment?: (activityId: string) => void;
  isLoading?: boolean;
  showConflicts?: boolean;
  compact?: boolean;
}

// Status colors
const getStatusColor = (status: 'should_do' | 'will_do' | null, theme: any) => {
  switch (status) {
    case 'will_do':
      return {
        bg: alpha(theme.palette.success.main, 0.1),
        border: theme.palette.success.main,
        text: theme.palette.success.dark,
      };
    case 'should_do':
      return {
        bg: alpha(theme.palette.warning.main, 0.1),
        border: theme.palette.warning.main,
        text: theme.palette.warning.dark,
      };
    default:
      return {
        bg: alpha(theme.palette.grey[500], 0.1),
        border: theme.palette.grey[400],
        text: theme.palette.text.secondary,
      };
  }
};

// Progress color based on completion for Chip component
const getChipProgressColor = (percentComplete: number): 'success' | 'info' | 'primary' | 'warning' | 'default' => {
  if (percentComplete >= 100) return 'success';
  if (percentComplete >= 75) return 'info';
  if (percentComplete >= 50) return 'primary';
  if (percentComplete >= 25) return 'warning';
  return 'default';
};

// Progress color based on completion for LinearProgress component
const getLinearProgressColor = (percentComplete: number): 'success' | 'info' | 'primary' | 'warning' | 'inherit' => {
  if (percentComplete >= 100) return 'success';
  if (percentComplete >= 75) return 'info';
  if (percentComplete >= 50) return 'primary';
  if (percentComplete >= 25) return 'warning';
  return 'inherit';
};

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

// Calculate days until/since date
const getDaysFromNow = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const SubcontractorTaskCard: React.FC<SubcontractorTaskCardProps> = ({
  activity,
  onStatusChange,
  onViewDetails,
  onAddAttachment,
  onAddComment,
  isLoading = false,
  showConflicts = true,
  compact = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [expanded, setExpanded] = useState(false);

  const statusColors = getStatusColor(activity.plannerStatus, theme);
  const daysUntilStart = getDaysFromNow(activity.startDate);
  const daysUntilFinish = getDaysFromNow(activity.finishDate);

  // Determine urgency
  const isOverdue = daysUntilFinish < 0 && activity.percentComplete < 100;
  const isDueSoon = daysUntilFinish >= 0 && daysUntilFinish <= 2;
  const isStartingSoon = daysUntilStart >= 0 && daysUntilStart <= 2;

  // Handle status button clicks
  const handleShouldDo = () => {
    if (!isLoading) {
      onStatusChange(activity.id, 'should_do');
    }
  };

  const handleWillDo = () => {
    if (!isLoading) {
      onStatusChange(activity.id, 'will_do');
    }
  };

  // Render conflict badges
  const renderConflictBadge = () => {
    if (!activity.hasConflict || !showConflicts) return null;

    const highSeverity = activity.conflicts?.filter((c) => c.severity === 'high').length || 0;
    const mediumSeverity = activity.conflicts?.filter((c) => c.severity === 'medium').length || 0;

    return (
      <Tooltip title={`${highSeverity} critical, ${mediumSeverity} warnings`}>
        <Badge
          badgeContent={activity.conflicts?.length || 0}
          color="error"
          sx={{ ml: 1 }}
        >
          <WarningIcon color="error" fontSize="small" />
        </Badge>
      </Tooltip>
    );
  };

  // Compact mobile view
  if (compact && isMobile) {
    return (
      <Card
        sx={{
          mb: 1,
          border: '2px solid',
          borderColor: statusColors.border,
          bgcolor: statusColors.bg,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activity.name}
            </Typography>
            {renderConflictBadge()}
          </Box>

          {/* Quick info row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Chip
              icon={<CalendarIcon />}
              label={formatDate(activity.startDate)}
              size="small"
              variant="outlined"
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
            <Chip
              icon={<TimerIcon />}
              label={`${activity.duration}d`}
              size="small"
              variant="outlined"
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
            <Chip
              label={`${activity.percentComplete}%`}
              size="small"
              color={getChipProgressColor(activity.percentComplete)}
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
          </Box>

          {/* Action buttons - full width on mobile */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={activity.plannerStatus === 'should_do' ? 'contained' : 'outlined'}
              color="warning"
              size="small"
              onClick={handleShouldDo}
              disabled={isLoading}
              startIcon={<ScheduleIcon />}
              sx={{
                flex: 1,
                py: 1,
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Should Do
            </Button>
            <Button
              variant={activity.plannerStatus === 'will_do' ? 'contained' : 'outlined'}
              color="success"
              size="small"
              onClick={handleWillDo}
              disabled={isLoading}
              startIcon={<CheckIcon />}
              sx={{
                flex: 1,
                py: 1,
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Will Do
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Full card view
  return (
    <Card
      sx={{
        mb: 2,
        border: '2px solid',
        borderColor: activity.hasConflict ? theme.palette.error.main : statusColors.border,
        bgcolor: activity.hasConflict ? alpha(theme.palette.error.main, 0.05) : statusColors.bg,
        borderRadius: 3,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* Progress bar at top */}
      <LinearProgress
        variant="determinate"
        value={activity.percentComplete}
        color={getLinearProgressColor(activity.percentComplete)}
        sx={{ height: 4 }}
      />

      <CardContent sx={{ p: isMobile ? 2 : 2.5 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography
                variant={isMobile ? 'body1' : 'h6'}
                fontWeight={600}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: isMobile ? 'normal' : 'nowrap',
                }}
              >
                {activity.name}
              </Typography>
              {renderConflictBadge()}
              {activity.isCommitted && (
                <Chip
                  icon={<DoneIcon />}
                  label="Committed"
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              {activity.hasPostCommitTweaks && (
                <Chip
                  icon={<FlagIcon />}
                  label="Modified"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>

            {/* Status indicator */}
            {activity.plannerStatus && (
              <Typography variant="caption" sx={{ color: statusColors.text, fontWeight: 500 }}>
                {activity.plannerStatus === 'will_do' ? '✓ Committed to complete' : '○ Planned for review'}
              </Typography>
            )}
          </Box>

          {/* Expand button */}
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ ml: 1 }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {/* Quick stats row */}
        <Box
          sx={{
            display: 'flex',
            gap: isMobile ? 1 : 2,
            mb: 2,
            flexWrap: 'wrap',
          }}
        >
          {/* Start date */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StartIcon fontSize="small" color={isStartingSoon ? 'warning' : 'action'} />
            <Typography variant="body2" fontWeight={isStartingSoon ? 600 : 400}>
              {formatDate(activity.startDate)}
              {daysUntilStart === 0 && (
                <Chip label="Today" size="small" color="warning" sx={{ ml: 0.5, height: 18 }} />
              )}
              {daysUntilStart === 1 && (
                <Chip label="Tomorrow" size="small" color="info" sx={{ ml: 0.5, height: 18 }} />
              )}
            </Typography>
          </Box>

          {/* Finish date */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarIcon fontSize="small" color={isOverdue ? 'error' : isDueSoon ? 'warning' : 'action'} />
            <Typography
              variant="body2"
              fontWeight={isOverdue || isDueSoon ? 600 : 400}
              color={isOverdue ? 'error.main' : 'inherit'}
            >
              {formatDate(activity.finishDate)}
              {isOverdue && (
                <Chip
                  label={`${Math.abs(daysUntilFinish)}d overdue`}
                  size="small"
                  color="error"
                  sx={{ ml: 0.5, height: 18 }}
                />
              )}
            </Typography>
          </Box>

          {/* Duration */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimerIcon fontSize="small" color="action" />
            <Typography variant="body2">{activity.duration} days</Typography>
          </Box>

          {/* Progress */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              label={`${activity.percentComplete}% complete`}
              size="small"
              color={getChipProgressColor(activity.percentComplete)}
              variant="filled"
            />
          </Box>
        </Box>

        {/* Action buttons */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <ButtonGroup
            variant="outlined"
            sx={{
              flex: isMobile ? 'none' : 1,
              width: isMobile ? '100%' : 'auto',
            }}
          >
            <Button
              variant={activity.plannerStatus === 'should_do' ? 'contained' : 'outlined'}
              color="warning"
              onClick={handleShouldDo}
              disabled={isLoading || activity.isCommitted}
              startIcon={<ScheduleIcon />}
              sx={{
                flex: 1,
                py: isMobile ? 1.5 : 1,
                fontWeight: 600,
                fontSize: isMobile ? '0.9rem' : '0.875rem',
              }}
            >
              Should Do
            </Button>
            <Button
              variant={activity.plannerStatus === 'will_do' ? 'contained' : 'outlined'}
              color="success"
              onClick={handleWillDo}
              disabled={isLoading || activity.isCommitted}
              startIcon={<CheckIcon />}
              sx={{
                flex: 1,
                py: isMobile ? 1.5 : 1,
                fontWeight: 600,
                fontSize: isMobile ? '0.9rem' : '0.875rem',
              }}
            >
              Will Do
            </Button>
          </ButtonGroup>

          {/* Quick action buttons */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {onAddAttachment && (
                <Tooltip title="Add Attachment">
                  <IconButton
                    size="small"
                    onClick={() => onAddAttachment(activity.id)}
                    sx={{ border: '1px solid', borderColor: 'divider' }}
                  >
                    <AttachIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {onAddComment && (
                <Tooltip title="Add Comment">
                  <IconButton
                    size="small"
                    onClick={() => onAddComment(activity.id)}
                    sx={{ border: '1px solid', borderColor: 'divider' }}
                  >
                    <CommentIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        {/* Expanded details */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />

          {/* Conflicts section */}
          {activity.hasConflict && activity.conflicts && activity.conflicts.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="error" gutterBottom>
                <ErrorIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                Conflicts ({activity.conflicts.length})
              </Typography>
              {activity.conflicts.map((conflict, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 1,
                    mb: 0.5,
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    borderRadius: 1,
                    borderLeft: '3px solid',
                    borderLeftColor:
                      conflict.severity === 'high'
                        ? 'error.main'
                        : conflict.severity === 'medium'
                        ? 'warning.main'
                        : 'info.main',
                  }}
                >
                  <Typography variant="caption" fontWeight={500}>
                    {conflict.type.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {conflict.message}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Additional info */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Activity ID:</strong> {activity.persistentInternalGuid.substring(0, 8)}...
            </Typography>
            {activity.plannerUpdatedBy && (
              <Typography variant="caption" color="text.secondary">
                <PersonIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                Last updated by: {activity.plannerUpdatedBy}
                {activity.plannerUpdatedAt && ` on ${new Date(activity.plannerUpdatedAt).toLocaleDateString()}`}
              </Typography>
            )}
          </Box>

          {/* Mobile action buttons in expanded view */}
          {isMobile && (
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              {onAddAttachment && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AttachIcon />}
                  onClick={() => onAddAttachment(activity.id)}
                  sx={{ flex: 1 }}
                >
                  Attach
                </Button>
              )}
              {onAddComment && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CommentIcon />}
                  onClick={() => onAddComment(activity.id)}
                  sx={{ flex: 1 }}
                >
                  Comment
                </Button>
              )}
              {onViewDetails && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onViewDetails(activity.id)}
                  sx={{ flex: 1 }}
                >
                  Details
                </Button>
              )}
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default SubcontractorTaskCard;
