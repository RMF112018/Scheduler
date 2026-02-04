import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
  Badge,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import type { LookaheadActivity } from '@store/slices/lookaheadSlice';

// Props interface
interface CalendarViewProps {
  activities: LookaheadActivity[];
  startDate: string;
  endDate?: string;
  onActivityClick?: (activityId: string) => void;
  onStatusChange?: (activityId: string, status: 'should_do' | 'will_do') => void;
  isLoading?: boolean;
}

// Helper to get week dates
const getWeekDates = (baseDate: Date): Date[] => {
  const dates: Date[] = [];
  const startOfWeek = new Date(baseDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  startOfWeek.setDate(diff);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }

  return dates;
};

// Format date for display
const formatDate = (date: Date, format: 'short' | 'full' = 'short'): string => {
  if (format === 'full') {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

// Check if date is today
const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// Check if activity spans a date
const activitySpansDate = (activity: LookaheadActivity, date: Date): boolean => {
  const actStart = new Date(activity.startDate);
  const actEnd = new Date(activity.finishDate);
  actStart.setHours(0, 0, 0, 0);
  actEnd.setHours(23, 59, 59, 999);
  date.setHours(12, 0, 0, 0);
  return date >= actStart && date <= actEnd;
};

// Get activity position in day (for stacking)
const getActivityPosition = (
  activity: LookaheadActivity,
  date: Date
): 'start' | 'middle' | 'end' | 'single' => {
  const actStart = new Date(activity.startDate);
  const actEnd = new Date(activity.finishDate);
  actStart.setHours(0, 0, 0, 0);
  actEnd.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  const isStart = actStart.getTime() === checkDate.getTime();
  const isEnd = actEnd.getTime() === checkDate.getTime();

  if (isStart && isEnd) return 'single';
  if (isStart) return 'start';
  if (isEnd) return 'end';
  return 'middle';
};

// Get status color
const getStatusColor = (
  status: 'should_do' | 'will_do' | null,
  hasConflict: boolean,
  theme: any
) => {
  if (hasConflict) {
    return {
      bg: alpha(theme.palette.error.main, 0.2),
      border: theme.palette.error.main,
      text: theme.palette.error.dark,
    };
  }

  switch (status) {
    case 'will_do':
      return {
        bg: alpha(theme.palette.success.main, 0.2),
        border: theme.palette.success.main,
        text: theme.palette.success.dark,
      };
    case 'should_do':
      return {
        bg: alpha(theme.palette.warning.main, 0.2),
        border: theme.palette.warning.main,
        text: theme.palette.warning.dark,
      };
    default:
      return {
        bg: alpha(theme.palette.grey[500], 0.15),
        border: theme.palette.grey[400],
        text: theme.palette.text.secondary,
      };
  }
};

const CalendarView: React.FC<CalendarViewProps> = ({
  activities,
  startDate,
  onActivityClick,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State for current week
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const start = new Date(startDate);
    return getWeekDates(start)[0];
  });

  // Get week dates
  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);

  // Filter activities for current week
  const weekActivities = useMemo(() => {
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    weekEnd.setHours(23, 59, 59, 999);

    return activities.filter((activity) => {
      const actStart = new Date(activity.startDate);
      const actEnd = new Date(activity.finishDate);
      return actEnd >= weekStart && actStart <= weekEnd;
    });
  }, [activities, weekDates]);

  // Group activities by day
  const activitiesByDay = useMemo(() => {
    const byDay: Map<string, LookaheadActivity[]> = new Map();

    weekDates.forEach((date) => {
      const dateKey = date.toISOString().split('T')[0];
      const dayActivities = weekActivities.filter((activity) =>
        activitySpansDate(activity, new Date(date))
      );
      byDay.set(dateKey, dayActivities);
    });

    return byDay;
  }, [weekActivities, weekDates]);

  // Navigation handlers
  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToToday = () => {
    setCurrentWeekStart(getWeekDates(new Date())[0]);
  };

  // Render activity bar
  const renderActivityBar = (activity: LookaheadActivity, date: Date) => {
    const position = getActivityPosition(activity, date);
    const colors = getStatusColor(activity.plannerStatus, activity.hasConflict, theme);

    const borderRadius =
      position === 'single'
        ? '6px'
        : position === 'start'
        ? '6px 0 0 6px'
        : position === 'end'
        ? '0 6px 6px 0'
        : '0';

    const showLabel = position === 'start' || position === 'single';

    return (
      <Tooltip
        key={activity.id}
        title={
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {activity.name}
            </Typography>
            <Typography variant="caption">
              {new Date(activity.startDate).toLocaleDateString()} -{' '}
              {new Date(activity.finishDate).toLocaleDateString()}
            </Typography>
            <br />
            <Typography variant="caption">
              {activity.duration} days | {activity.percentComplete}% complete
            </Typography>
            {activity.plannerStatus && (
              <>
                <br />
                <Typography variant="caption">
                  Status: {activity.plannerStatus === 'will_do' ? 'Will Do ✓' : 'Should Do'}
                </Typography>
              </>
            )}
          </Box>
        }
        arrow
        placement="top"
      >
        <Box
          onClick={() => onActivityClick?.(activity.id)}
          sx={{
            height: isMobile ? 28 : 32,
            bgcolor: colors.bg,
            borderTop: `2px solid ${colors.border}`,
            borderBottom: `2px solid ${colors.border}`,
            borderLeft: position === 'start' || position === 'single' ? `2px solid ${colors.border}` : 'none',
            borderRight: position === 'end' || position === 'single' ? `2px solid ${colors.border}` : 'none',
            borderRadius,
            display: 'flex',
            alignItems: 'center',
            px: showLabel ? 1 : 0,
            cursor: onActivityClick ? 'pointer' : 'default',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: alpha(colors.border, 0.3),
              transform: 'scale(1.02)',
            },
          }}
        >
          {showLabel && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
              {activity.hasConflict && (
                <WarningIcon sx={{ fontSize: 14, color: 'error.main', flexShrink: 0 }} />
              )}
              {activity.plannerStatus === 'will_do' && !activity.hasConflict && (
                <CheckIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
              )}
              {activity.plannerStatus === 'should_do' && !activity.hasConflict && (
                <ScheduleIcon sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0 }} />
              )}
              <Typography
                variant="caption"
                sx={{
                  color: colors.text,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: isMobile ? '0.65rem' : '0.75rem',
                }}
              >
                {activity.name}
              </Typography>
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  };

  // Render day column
  const renderDayColumn = (date: Date, index: number) => {
    const dateKey = date.toISOString().split('T')[0];
    const dayActivities = activitiesByDay.get(dateKey) || [];
    const today = isToday(date);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    return (
      <Box
        key={dateKey}
        sx={{
          flex: 1,
          minWidth: isMobile ? 100 : 120,
          borderRight: index < 6 ? '1px solid' : 'none',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Day header */}
        <Box
          sx={{
            p: 1,
            textAlign: 'center',
            bgcolor: today
              ? alpha(theme.palette.primary.main, 0.1)
              : isWeekend
              ? alpha(theme.palette.grey[500], 0.05)
              : 'transparent',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: today ? 700 : 500,
              color: today ? 'primary.main' : isWeekend ? 'text.secondary' : 'text.primary',
              textTransform: 'uppercase',
              fontSize: isMobile ? '0.6rem' : '0.7rem',
            }}
          >
            {date.toLocaleDateString('en-US', { weekday: 'short' })}
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: today ? 700 : 500,
              color: today ? 'primary.main' : 'text.primary',
              fontSize: isMobile ? '1rem' : '1.25rem',
            }}
          >
            {date.getDate()}
          </Typography>
          {today && (
            <Chip
              label="Today"
              size="small"
              color="primary"
              sx={{ height: 18, fontSize: '0.6rem', mt: 0.5 }}
            />
          )}
        </Box>

        {/* Activities */}
        <Box
          sx={{
            flex: 1,
            p: 0.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            minHeight: 200,
            bgcolor: isWeekend ? alpha(theme.palette.grey[500], 0.03) : 'transparent',
          }}
        >
          {dayActivities.length === 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: 'center', mt: 2, fontStyle: 'italic' }}
            >
              No activities
            </Typography>
          ) : (
            dayActivities.map((activity) => renderActivityBar(activity, date))
          )}
        </Box>

        {/* Day summary */}
        {dayActivities.length > 0 && (
          <Box
            sx={{
              p: 0.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'grey.50',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              {dayActivities.filter((a) => a.plannerStatus === 'will_do').length > 0 && (
                <Chip
                  icon={<CheckIcon sx={{ fontSize: '0.8rem !important' }} />}
                  label={dayActivities.filter((a) => a.plannerStatus === 'will_do').length}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}
              {dayActivities.filter((a) => a.plannerStatus === 'should_do').length > 0 && (
                <Chip
                  icon={<ScheduleIcon sx={{ fontSize: '0.8rem !important' }} />}
                  label={dayActivities.filter((a) => a.plannerStatus === 'should_do').length}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}
              {dayActivities.filter((a) => a.hasConflict).length > 0 && (
                <Chip
                  icon={<WarningIcon sx={{ fontSize: '0.8rem !important' }} />}
                  label={dayActivities.filter((a) => a.hasConflict).length}
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Paper
      elevation={2}
      sx={{
        overflow: 'hidden',
        borderRadius: 2,
      }}
    >
      {/* Header with navigation */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={goToPreviousWeek} size="small">
            <ChevronLeftIcon />
          </IconButton>
          <IconButton onClick={goToToday} size="small" color="primary">
            <TodayIcon />
          </IconButton>
          <IconButton onClick={goToNextWeek} size="small">
            <ChevronRightIcon />
          </IconButton>
        </Box>

        <Typography variant="h6" fontWeight={600}>
          {weekDates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={weekActivities.length} color="primary">
            <Chip
              label={`${weekActivities.length} activities`}
              size="small"
              variant="outlined"
            />
          </Badge>
        </Box>
      </Box>

      {/* Week range subtitle */}
      <Box sx={{ px: 2, py: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
        </Typography>
      </Box>

      {/* Calendar grid */}
      <Box
        sx={{
          display: 'flex',
          overflowX: 'auto',
          minHeight: 350,
        }}
      >
        {weekDates.map((date, index) => renderDayColumn(date, index))}
      </Box>

      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          p: 1.5,
          bgcolor: 'grey.50',
          borderTop: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: '4px',
              bgcolor: alpha(theme.palette.success.main, 0.2),
              border: `2px solid ${theme.palette.success.main}`,
            }}
          />
          <Typography variant="caption">Will Do</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: '4px',
              bgcolor: alpha(theme.palette.warning.main, 0.2),
              border: `2px solid ${theme.palette.warning.main}`,
            }}
          />
          <Typography variant="caption">Should Do</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: '4px',
              bgcolor: alpha(theme.palette.error.main, 0.2),
              border: `2px solid ${theme.palette.error.main}`,
            }}
          />
          <Typography variant="caption">Has Conflict</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: '4px',
              bgcolor: alpha(theme.palette.grey[500], 0.15),
              border: `2px solid ${theme.palette.grey[400]}`,
            }}
          />
          <Typography variant="caption">Not Set</Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default CalendarView;
