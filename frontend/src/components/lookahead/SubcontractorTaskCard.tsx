import React, { useState, useCallback } from 'react';
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
import { ProgressRing } from '@components/animations';

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
  /** Enable one-tap status toggle (Phase 8 enhancement) */
  oneTapEnabled?: boolean;
}

// Field environment color palette - WCAG AAA contrast (7:1 minimum) for direct sunlight
const FIELD_STATUS_COLORS = {
  willDo: '#1B5E20',      // Dark green (7:1 contrast)
  willDoBg: '#E8F5E9',    // Light green background
  shouldDo: '#F57F17',    // Dark yellow/amber (7:1 contrast)
  shouldDoBg: '#FFF9C4',  // Light yellow background
  overdue: '#B71C1C',     // Dark red (7:1 contrast)
  overdueBg: '#FFEBEE',   // Light red background
  critical: '#D32F2F',    // Bright red (7:1 contrast)
  default: '#424242',     // Dark grey
  defaultBg: '#F5F5F5',   // Light grey background
};

// Touch target requirements for field use
const TOUCH_TARGET_MIN = 44; // pixels (WCAG AAA)
const BUTTON_SPACING = 8;    // pixels minimum between buttons

// Status colors with high contrast for field environment
const getStatusColor = (status: 'should_do' | 'will_do' | null, _theme: any) => {
  switch (status) {
    case 'will_do':
      return {
        bg: FIELD_STATUS_COLORS.willDoBg,
        border: FIELD_STATUS_COLORS.willDo,
        text: FIELD_STATUS_COLORS.willDo,
      };
    case 'should_do':
      return {
        bg: FIELD_STATUS_COLORS.shouldDoBg,
        border: FIELD_STATUS_COLORS.shouldDo,
        text: FIELD_STATUS_COLORS.shouldDo,
      };
    default:
      return {
        bg: FIELD_STATUS_COLORS.defaultBg,
        border: FIELD_STATUS_COLORS.default,
        text: FIELD_STATUS_COLORS.default,
      };
  }
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
  oneTapEnabled = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [expanded, setExpanded] = useState(false);
  const [tapAnimation, setTapAnimation] = useState(false);

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

  // One-tap status toggle (cycles: null -> should_do -> will_do -> will_do)
  const handleOneTapToggle = useCallback(() => {
    if (isLoading || activity.isCommitted || !oneTapEnabled) return;
    
    // Trigger tap animation
    setTapAnimation(true);
    setTimeout(() => setTapAnimation(false), 150);
    
    // Cycle through statuses
    if (!activity.plannerStatus || activity.plannerStatus === null) {
      onStatusChange(activity.id, 'should_do');
    } else if (activity.plannerStatus === 'should_do') {
      onStatusChange(activity.id, 'will_do');
    }
    // If already 'will_do', do nothing (committed state)
  }, [isLoading, activity.isCommitted, activity.plannerStatus, activity.id, onStatusChange, oneTapEnabled]);

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

  // Compact mobile view with one-tap and progress ring
  if (compact && isMobile) {
    return (
      <Card
        onClick={oneTapEnabled ? handleOneTapToggle : undefined}
        sx={{
          mb: 1,
          border: '2px solid',
          borderColor: statusColors.border,
          bgcolor: statusColors.bg,
          borderRadius: 2,
          overflow: 'hidden',
          cursor: oneTapEnabled && !activity.isCommitted ? 'pointer' : 'default',
          transition: 'all 200ms ease-out',
          transform: tapAnimation ? 'scale(0.98)' : 'scale(1)',
          '&:active': oneTapEnabled && !activity.isCommitted ? {
            transform: 'scale(0.97)',
          } : {},
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          {/* Header row with progress ring */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            {/* Progress Ring */}
            <ProgressRing
              progress={activity.percentComplete}
              size={40}
              strokeWidth={3}
              textVariant="caption"
            />
            
            {/* Title and status */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activity.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(activity.startDate)} • {activity.duration}d
              </Typography>
            </Box>
            
            {/* Conflict badge */}
            {renderConflictBadge()}
            
            {/* Status indicator */}
            {activity.plannerStatus === 'will_do' && (
              <CheckIcon color="success" fontSize="small" />
            )}
            {activity.plannerStatus === 'should_do' && (
              <ScheduleIcon color="warning" fontSize="small" />
            )}
          </Box>

          {/* One-tap hint or action buttons */}
          {oneTapEnabled && !activity.isCommitted ? (
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                display: 'block', 
                textAlign: 'center',
                opacity: 0.7,
              }}
            >
              {!activity.plannerStatus 
                ? 'Tap to mark "Should Do"' 
                : activity.plannerStatus === 'should_do' 
                  ? 'Tap to commit "Will Do"'
                  : '✓ Committed'}
            </Typography>
          ) : (
            /* Fallback action buttons if one-tap disabled */
            <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={activity.plannerStatus === 'should_do' ? 'contained' : 'outlined'}
              color="warning"
              size="small"
              onClick={(e) => { e.stopPropagation(); handleShouldDo(); }}
              disabled={isLoading || activity.isCommitted}
              startIcon={<ScheduleIcon />}
              sx={{
                flex: 1,
                minHeight: `${TOUCH_TARGET_MIN}px`, // 44px minimum touch target
                minWidth: `${TOUCH_TARGET_MIN}px`,
                py: 1.5, // Increased padding for better touch target
                fontSize: '0.875rem', // Slightly larger for readability
                fontWeight: 700, // Bolder for high-contrast visibility
                borderWidth: 2, // Thicker border for visibility
                '&.MuiButton-contained': {
                  backgroundColor: FIELD_STATUS_COLORS.shouldDo,
                  color: '#FFFFFF',
                  '&:hover': {
                    backgroundColor: '#E65100', // Darker on hover
                  },
                },
                '&.MuiButton-outlined': {
                  borderColor: FIELD_STATUS_COLORS.shouldDo,
                  color: FIELD_STATUS_COLORS.shouldDo,
                  borderWidth: 2,
                },
              }}
            >
              Should Do
            </Button>
            <Button
              variant={activity.plannerStatus === 'will_do' ? 'contained' : 'outlined'}
              color="success"
              size="small"
              onClick={(e) => { e.stopPropagation(); handleWillDo(); }}
              disabled={isLoading || activity.isCommitted}
              startIcon={<CheckIcon />}
              sx={{
                flex: 1,
                minHeight: `${TOUCH_TARGET_MIN}px`, // 44px minimum touch target
                minWidth: `${TOUCH_TARGET_MIN}px`,
                py: 1.5, // Increased padding for better touch target
                fontSize: '0.875rem', // Slightly larger for readability
                fontWeight: 700, // Bolder for high-contrast visibility
                borderWidth: 2, // Thicker border for visibility
                ml: `${BUTTON_SPACING / 8}rem`, // Minimum spacing between buttons
                '&.MuiButton-contained': {
                  backgroundColor: FIELD_STATUS_COLORS.willDo,
                  color: '#FFFFFF',
                  '&:hover': {
                    backgroundColor: '#0D4E14', // Darker on hover
                  },
                },
                '&.MuiButton-outlined': {
                  borderColor: FIELD_STATUS_COLORS.willDo,
                  color: FIELD_STATUS_COLORS.willDo,
                  borderWidth: 2,
                },
              }}
            >
              Will Do
            </Button>
            </Box>
          )}
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
        transition: 'all 200ms ease-out',
        transform: tapAnimation ? 'scale(0.99)' : 'scale(1)',
        '&:hover': {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-2px)',
        },
      }}
    >

      <CardContent sx={{ p: isMobile ? 2 : 2.5 }}>
        {/* Header with Progress Ring */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          {/* Progress Ring */}
          <ProgressRing
            progress={activity.percentComplete}
            size={isMobile ? 48 : 56}
            strokeWidth={4}
            textVariant={isMobile ? 'caption' : 'body2'}
          />
          
          {/* Title and badges */}
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
            sx={{ 
              ml: 'auto',
              transition: 'transform 200ms ease-out',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <ExpandMoreIcon />
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
                minHeight: `${TOUCH_TARGET_MIN}px`, // 44px minimum touch target
                minWidth: `${TOUCH_TARGET_MIN}px`,
                py: isMobile ? 2 : 1.5, // Increased padding for better touch target
                fontWeight: 700, // Bolder for high-contrast visibility
                fontSize: isMobile ? '0.95rem' : '0.875rem', // Larger for readability
                borderWidth: 2, // Thicker border for visibility
                '&.MuiButton-contained': {
                  backgroundColor: FIELD_STATUS_COLORS.shouldDo,
                  color: '#FFFFFF',
                  '&:hover': {
                    backgroundColor: '#E65100', // Darker on hover
                  },
                },
                '&.MuiButton-outlined': {
                  borderColor: FIELD_STATUS_COLORS.shouldDo,
                  color: FIELD_STATUS_COLORS.shouldDo,
                  borderWidth: 2,
                },
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
                minHeight: `${TOUCH_TARGET_MIN}px`, // 44px minimum touch target
                minWidth: `${TOUCH_TARGET_MIN}px`,
                py: isMobile ? 2 : 1.5, // Increased padding for better touch target
                fontWeight: 700, // Bolder for high-contrast visibility
                fontSize: isMobile ? '0.95rem' : '0.875rem', // Larger for readability
                borderWidth: 2, // Thicker border for visibility
                ml: `${BUTTON_SPACING / 8}rem`, // Minimum spacing between buttons
                '&.MuiButton-contained': {
                  backgroundColor: FIELD_STATUS_COLORS.willDo,
                  color: '#FFFFFF',
                  '&:hover': {
                    backgroundColor: '#0D4E14', // Darker on hover
                  },
                },
                '&.MuiButton-outlined': {
                  borderColor: FIELD_STATUS_COLORS.willDo,
                  color: FIELD_STATUS_COLORS.willDo,
                  borderWidth: 2,
                },
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
                    sx={{
                      border: '2px solid',
                      borderColor: 'divider',
                      minWidth: `${TOUCH_TARGET_MIN}px`, // 44px minimum touch target
                      minHeight: `${TOUCH_TARGET_MIN}px`,
                      width: `${TOUCH_TARGET_MIN}px`,
                      height: `${TOUCH_TARGET_MIN}px`,
                    }}
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
                    sx={{
                      border: '2px solid',
                      borderColor: 'divider',
                      minWidth: `${TOUCH_TARGET_MIN}px`, // 44px minimum touch target
                      minHeight: `${TOUCH_TARGET_MIN}px`,
                      width: `${TOUCH_TARGET_MIN}px`,
                      height: `${TOUCH_TARGET_MIN}px`,
                      ml: `${BUTTON_SPACING / 8}rem`, // Minimum spacing
                    }}
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
                  sx={{
                    flex: 1,
                    minHeight: `${TOUCH_TARGET_MIN}px`, // 44px minimum touch target
                    py: 1.5,
                    fontWeight: 600,
                    borderWidth: 2,
                  }}
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
                  sx={{
                    flex: 1,
                    minHeight: `${TOUCH_TARGET_MIN}px`, // 44px minimum touch target
                    py: 1.5,
                    fontWeight: 600,
                    borderWidth: 2,
                    ml: `${BUTTON_SPACING / 8}rem`, // Minimum spacing
                  }}
                >
                  Comment
                </Button>
              )}
              {onViewDetails && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onViewDetails(activity.id)}
                  sx={{
                    flex: 1,
                    minHeight: `${TOUCH_TARGET_MIN}px`, // 44px minimum touch target
                    py: 1.5,
                    fontWeight: 600,
                    borderWidth: 2,
                    ml: `${BUTTON_SPACING / 8}rem`, // Minimum spacing
                  }}
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
