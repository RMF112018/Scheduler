import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
  Assignment as TaskIcon,
  AttachFile as AttachmentIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { ProgressRing } from '@components/animations';

// ============================================
// Types
// ============================================

export interface ApprovalItem {
  id: string;
  lookaheadId: string;
  lookaheadName: string;
  projectId: string;
  projectName: string;
  submittedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  submittedAt: string;
  activitiesCount: number;
  attachmentsCount: number;
  conflictsCount: number;
  status: 'pending' | 'approved' | 'rejected';
  averageProgress: number;
}

interface ApprovalCardProps {
  item: ApprovalItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onView: (id: string) => void;
  isLoading?: boolean;
  showActions?: boolean;
}

// ============================================
// Helper Functions
// ============================================

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// ============================================
// Component
// ============================================

const ApprovalCard: React.FC<ApprovalCardProps> = ({
  item,
  onApprove,
  onReject,
  onView,
  isLoading = false,
  showActions = true,
}) => {
  const theme = useTheme();

  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoading) onApprove(item.id);
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoading) onReject(item.id);
  };

  const handleView = () => {
    if (!isLoading) onView(item.id);
  };

  return (
    <Card
      onClick={handleView}
      sx={{
        mb: 2,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: item.conflictsCount > 0 
          ? alpha(theme.palette.warning.main, 0.5)
          : 'divider',
        borderRadius: 3,
        transition: 'all 200ms ease-out',
        '&:hover': {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-2px)',
        },
        '&:active': {
          transform: 'scale(0.99)',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header Row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          {/* Progress Ring */}
          <ProgressRing
            progress={item.averageProgress}
            size={48}
            strokeWidth={4}
            textVariant="caption"
          />

          {/* Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.lookaheadName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.projectName}
            </Typography>
          </Box>

          {/* Conflict Warning */}
          {item.conflictsCount > 0 && (
            <Tooltip title={`${item.conflictsCount} conflicts`}>
              <Chip
                icon={<WarningIcon />}
                label={item.conflictsCount}
                size="small"
                color="warning"
                sx={{ height: 24 }}
              />
            </Tooltip>
          )}
        </Box>

        {/* Stats Row */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TaskIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {item.activitiesCount} activities
            </Typography>
          </Box>
          {item.attachmentsCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AttachmentIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {item.attachmentsCount} files
              </Typography>
            </Box>
          )}
        </Box>

        {/* Submitter Row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              sx={{
                width: 28,
                height: 28,
                fontSize: '0.75rem',
                bgcolor: theme.palette.primary.main,
              }}
            >
              {getInitials(item.submittedBy.firstName, item.submittedBy.lastName)}
            </Avatar>
            <Box>
              <Typography variant="caption" fontWeight={500}>
                {item.submittedBy.firstName} {item.submittedBy.lastName}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <ScheduleIcon sx={{ fontSize: 12 }} />
                {formatDate(item.submittedAt)}
              </Typography>
            </Box>
          </Box>

          {/* Action Buttons */}
          {showActions && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="View Details">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleView(); }}
                  sx={{ color: 'text.secondary' }}
                >
                  <ViewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject">
                <IconButton
                  size="small"
                  onClick={handleReject}
                  disabled={isLoading}
                  sx={{
                    color: 'error.main',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                    },
                  }}
                >
                  <RejectIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Approve">
                <IconButton
                  size="small"
                  onClick={handleApprove}
                  disabled={isLoading}
                  sx={{
                    color: 'success.main',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                    },
                  }}
                >
                  <ApproveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ApprovalCard;
