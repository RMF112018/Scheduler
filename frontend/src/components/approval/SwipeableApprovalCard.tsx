import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Assignment as TaskIcon,
  AttachFile as AttachmentIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { ProgressRing } from '@components/animations';
import type { ApprovalItem } from './ApprovalCard';

// ============================================
// Types
// ============================================

interface SwipeableApprovalCardProps {
  item: ApprovalItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onView: (id: string) => void;
  isLoading?: boolean;
  /** Swipe threshold in pixels */
  swipeThreshold?: number;
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

const SwipeableApprovalCard: React.FC<SwipeableApprovalCardProps> = ({
  item,
  onApprove,
  onReject,
  onView,
  isLoading = false,
  swipeThreshold = 80,
}) => {
  const theme = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Swipe state
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  // Calculate swipe offset
  const offset = isDragging ? currentX - startX : 0;
  const swipeProgress = Math.min(Math.abs(offset) / swipeThreshold, 1);
  const isApproveSwipe = offset > 0;
  const isRejectSwipe = offset < 0;

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isLoading || isExiting) return;
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
    setIsDragging(true);
  }, [isLoading, isExiting]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || isLoading || isExiting) return;
    setCurrentX(e.touches[0].clientX);
  }, [isDragging, isLoading, isExiting]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || isLoading || isExiting) return;
    
    const finalOffset = currentX - startX;
    
    if (Math.abs(finalOffset) >= swipeThreshold) {
      // Trigger action
      setIsExiting(true);
      setExitDirection(finalOffset > 0 ? 'right' : 'left');
      
      setTimeout(() => {
        if (finalOffset > 0) {
          onApprove(item.id);
        } else {
          onReject(item.id);
        }
      }, 200);
    } else {
      // Reset position
      setStartX(0);
      setCurrentX(0);
    }
    
    setIsDragging(false);
  }, [isDragging, isLoading, isExiting, currentX, startX, swipeThreshold, item.id, onApprove, onReject]);

  // Mouse handlers (for desktop testing)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLoading || isExiting) return;
    setStartX(e.clientX);
    setCurrentX(e.clientX);
    setIsDragging(true);
  }, [isLoading, isExiting]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || isLoading || isExiting) return;
    setCurrentX(e.clientX);
  }, [isDragging, isLoading, isExiting]);

  const handleMouseUp = useCallback(() => {
    handleTouchEnd();
  }, [handleTouchEnd]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      handleTouchEnd();
    }
  }, [isDragging, handleTouchEnd]);

  // Click handler (only if not swiping)
  const handleClick = useCallback(() => {
    if (Math.abs(offset) < 10 && !isExiting) {
      onView(item.id);
    }
  }, [offset, isExiting, item.id, onView]);

  return (
    <Box
      sx={{
        position: 'relative',
        mb: 2,
        overflow: 'hidden',
        borderRadius: 3,
      }}
    >
      {/* Background reveal indicators */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        {/* Approve reveal (right swipe) */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            pl: 3,
            bgcolor: alpha(theme.palette.success.main, 0.15 + swipeProgress * 0.35),
            transition: isDragging ? 'none' : 'background-color 200ms ease-out',
          }}
        >
          <ApproveIcon
            sx={{
              fontSize: 32,
              color: 'success.main',
              opacity: isApproveSwipe ? swipeProgress : 0.3,
              transform: `scale(${isApproveSwipe ? 0.8 + swipeProgress * 0.4 : 0.8})`,
              transition: isDragging ? 'none' : 'all 200ms ease-out',
            }}
          />
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              ml: 1,
              color: 'success.main',
              opacity: isApproveSwipe && swipeProgress > 0.5 ? 1 : 0,
              transition: 'opacity 150ms ease-out',
            }}
          >
            Approve
          </Typography>
        </Box>

        {/* Reject reveal (left swipe) */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pr: 3,
            bgcolor: alpha(theme.palette.error.main, 0.15 + swipeProgress * 0.35),
            transition: isDragging ? 'none' : 'background-color 200ms ease-out',
          }}
        >
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              mr: 1,
              color: 'error.main',
              opacity: isRejectSwipe && swipeProgress > 0.5 ? 1 : 0,
              transition: 'opacity 150ms ease-out',
            }}
          >
            Reject
          </Typography>
          <RejectIcon
            sx={{
              fontSize: 32,
              color: 'error.main',
              opacity: isRejectSwipe ? swipeProgress : 0.3,
              transform: `scale(${isRejectSwipe ? 0.8 + swipeProgress * 0.4 : 0.8})`,
              transition: isDragging ? 'none' : 'all 200ms ease-out',
            }}
          />
        </Box>
      </Box>

      {/* Card content */}
      <Card
        ref={cardRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        sx={{
          position: 'relative',
          cursor: 'pointer',
          border: '1px solid',
          borderColor: item.conflictsCount > 0 
            ? alpha(theme.palette.warning.main, 0.5)
            : 'divider',
          borderRadius: 3,
          transform: isExiting
            ? `translateX(${exitDirection === 'right' ? '100%' : '-100%'})`
            : `translateX(${offset}px)`,
          opacity: isExiting ? 0 : 1,
          transition: isDragging 
            ? 'none' 
            : 'transform 200ms ease-out, opacity 200ms ease-out',
          userSelect: 'none',
          touchAction: 'pan-y',
          bgcolor: 'background.paper',
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Header Row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.5 }}>
            {/* Progress Ring */}
            <ProgressRing
              progress={item.averageProgress}
              size={44}
              strokeWidth={3}
              textVariant="caption"
            />

            {/* Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
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
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: 'warning.main',
                }}
              >
                <WarningIcon fontSize="small" />
                <Typography variant="caption" fontWeight={600}>
                  {item.conflictsCount}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Stats and Submitter Row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            {/* Stats */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TaskIcon sx={{ fontSize: 14 }} color="action" />
                <Typography variant="caption">{item.activitiesCount}</Typography>
              </Box>
              {item.attachmentsCount > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AttachmentIcon sx={{ fontSize: 14 }} color="action" />
                  <Typography variant="caption">{item.attachmentsCount}</Typography>
                </Box>
              )}
            </Box>

            {/* Submitter */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: '0.65rem',
                  bgcolor: theme.palette.primary.main,
                }}
              >
                {getInitials(item.submittedBy.firstName, item.submittedBy.lastName)}
              </Avatar>
              <Typography variant="caption" color="text.secondary">
                {formatDate(item.submittedAt)}
              </Typography>
            </Box>
          </Box>

          {/* Swipe hint */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              textAlign: 'center',
              mt: 1,
              opacity: 0.6,
            }}
          >
            ← Swipe to approve or reject →
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SwipeableApprovalCard;
