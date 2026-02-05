import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  useTheme,
  alpha,
  Skeleton,
} from '@mui/material';
import {
  Assignment as ApprovalIcon,
  Warning as OverdueIcon,
  Schedule as ScheduleIcon,
  TrendingUp as ProgressIcon,
  Notifications as NotificationIcon,
  ArrowForward as ArrowIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// ============================================
// Types
// ============================================

export interface QuickWin {
  id: string;
  title: string;
  description: string;
  action: string;
  route: string;
  icon: React.ReactNode;
  priority: 'high' | 'medium' | 'low';
  count?: number;
}

interface QuickWinsSuggestionsProps {
  /** Dashboard statistics to generate suggestions */
  stats?: {
    pendingApprovals?: number;
    overdueActivities?: number;
    upcomingDeadlines?: number;
    unreadNotifications?: number;
    incompleteProgress?: number;
  };
  /** Custom quick wins (overrides auto-generated) */
  customWins?: QuickWin[];
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a win is dismissed */
  onDismiss?: (id: string) => void;
  /** Whether to show in compact mode */
  compact?: boolean;
}

// ============================================
// Helper Functions
// ============================================

const getPriorityColor = (priority: 'high' | 'medium' | 'low'): 'error' | 'warning' | 'info' => {
  switch (priority) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    default:
      return 'info';
  }
};

const generateQuickWins = (stats: QuickWinsSuggestionsProps['stats']): QuickWin[] => {
  if (!stats) return [];
  
  const wins: QuickWin[] = [];

  if (stats.pendingApprovals && stats.pendingApprovals > 0) {
    wins.push({
      id: 'pending-approvals',
      title: `${stats.pendingApprovals} approvals waiting`,
      description: 'Review and approve lookahead submissions',
      action: 'Review Now',
      route: '/approvals',
      icon: <ApprovalIcon />,
      priority: 'high',
      count: stats.pendingApprovals,
    });
  }

  if (stats.overdueActivities && stats.overdueActivities > 0) {
    wins.push({
      id: 'overdue-activities',
      title: `${stats.overdueActivities} activities overdue`,
      description: 'Update progress or adjust dates',
      action: 'View Activities',
      route: '/activities?filter=overdue',
      icon: <OverdueIcon />,
      priority: 'high',
      count: stats.overdueActivities,
    });
  }

  if (stats.upcomingDeadlines && stats.upcomingDeadlines > 0) {
    wins.push({
      id: 'upcoming-deadlines',
      title: `${stats.upcomingDeadlines} deadlines this week`,
      description: 'Check upcoming milestones',
      action: 'View Schedule',
      route: '/schedules?view=deadlines',
      icon: <ScheduleIcon />,
      priority: 'medium',
      count: stats.upcomingDeadlines,
    });
  }

  if (stats.unreadNotifications && stats.unreadNotifications > 0) {
    wins.push({
      id: 'unread-notifications',
      title: `${stats.unreadNotifications} unread notifications`,
      description: 'Stay up to date with project changes',
      action: 'View All',
      route: '/notifications',
      icon: <NotificationIcon />,
      priority: 'low',
      count: stats.unreadNotifications,
    });
  }

  if (stats.incompleteProgress && stats.incompleteProgress > 0) {
    wins.push({
      id: 'incomplete-progress',
      title: 'Update progress',
      description: `${stats.incompleteProgress} activities need progress updates`,
      action: 'Update Now',
      route: '/lookahead/today',
      icon: <ProgressIcon />,
      priority: 'medium',
      count: stats.incompleteProgress,
    });
  }

  return wins;
};

// ============================================
// Quick Win Card Component
// ============================================

interface QuickWinCardProps {
  win: QuickWin;
  onAction: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

const QuickWinCard: React.FC<QuickWinCardProps> = ({
  win,
  onAction,
  onDismiss,
  compact = false,
}) => {
  const theme = useTheme();
  const priorityColor = getPriorityColor(win.priority);

  if (compact) {
    return (
      <Box
        onClick={onAction}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          borderRadius: 2,
          cursor: 'pointer',
          bgcolor: alpha(theme.palette[priorityColor].main, 0.08),
          border: '1px solid',
          borderColor: alpha(theme.palette[priorityColor].main, 0.2),
          transition: 'all 200ms ease-out',
          '&:hover': {
            bgcolor: alpha(theme.palette[priorityColor].main, 0.12),
            transform: 'translateX(4px)',
          },
        }}
      >
        <Box
          sx={{
            color: `${priorityColor}.main`,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {win.icon}
        </Box>
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
            {win.title}
          </Typography>
        </Box>
        <ArrowIcon fontSize="small" color="action" />
      </Box>
    );
  }

  return (
    <Card
      sx={{
        border: '1px solid',
        borderColor: alpha(theme.palette[priorityColor].main, 0.3),
        borderLeft: '4px solid',
        borderLeftColor: `${priorityColor}.main`,
        transition: 'all 200ms ease-out',
        '&:hover': {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ color: `${priorityColor}.main` }}>{win.icon}</Box>
            <Typography variant="subtitle2" fontWeight={600}>
              {win.title}
            </Typography>
          </Box>
          {onDismiss && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              sx={{ ml: 1, p: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {win.description}
        </Typography>

        <Button
          variant="outlined"
          size="small"
          color={priorityColor}
          onClick={onAction}
          endIcon={<ArrowIcon />}
          sx={{ fontWeight: 600 }}
        >
          {win.action}
        </Button>
      </CardContent>
    </Card>
  );
};

// ============================================
// Main Component
// ============================================

const QuickWinsSuggestions: React.FC<QuickWinsSuggestionsProps> = ({
  stats,
  customWins,
  maxSuggestions = 3,
  isLoading = false,
  onDismiss,
  compact = false,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Generate or use custom wins
  const allWins = customWins || generateQuickWins(stats);
  const displayedWins = allWins.slice(0, maxSuggestions);

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={compact ? 56 : 120}
            sx={{ borderRadius: 2 }}
          />
        ))}
      </Box>
    );
  }

  // Empty state
  if (displayedWins.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 4,
          px: 2,
          textAlign: 'center',
          bgcolor: alpha(theme.palette.success.main, 0.08),
          borderRadius: 3,
          border: '1px solid',
          borderColor: alpha(theme.palette.success.main, 0.2),
        }}
      >
        <CheckIcon
          sx={{
            fontSize: 40,
            color: 'success.main',
            mb: 1,
          }}
        />
        <Typography variant="subtitle1" fontWeight={600} color="success.main">
          All caught up!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No urgent items requiring attention
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {!compact && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Quick Wins
          </Typography>
          <Chip
            label={displayedWins.length}
            size="small"
            color="primary"
            sx={{ height: 20 }}
          />
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 1 : 2,
        }}
      >
        {displayedWins.map((win) => (
          <QuickWinCard
            key={win.id}
            win={win}
            onAction={() => navigate(win.route)}
            onDismiss={onDismiss ? () => onDismiss(win.id) : undefined}
            compact={compact}
          />
        ))}
      </Box>
    </Box>
  );
};

// ============================================
// Default Export
// ============================================

export default QuickWinsSuggestions;
