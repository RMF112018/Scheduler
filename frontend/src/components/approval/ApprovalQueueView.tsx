import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  Divider,
  Paper,
  useTheme,
  useMediaQuery,
  alpha,
  Skeleton,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Inbox as EmptyIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import ApprovalCard, { type ApprovalItem } from './ApprovalCard';
import SwipeableApprovalCard from './SwipeableApprovalCard';
import { CommitSuccessAnimation } from '@components/animations';

// ============================================
// Types
// ============================================

interface ApprovalQueueViewProps {
  items: ApprovalItem[];
  isLoading?: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onView: (id: string) => void;
  onRefresh?: () => void;
}

type SortOption = 'newest' | 'oldest' | 'most_activities' | 'most_conflicts';
type FilterOption = 'all' | 'with_conflicts' | 'no_conflicts';

// ============================================
// Component
// ============================================

const ApprovalQueueView: React.FC<ApprovalQueueViewProps> = ({
  items,
  isLoading = false,
  onApprove,
  onReject,
  onView,
  onRefresh,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.lookaheadName.toLowerCase().includes(query) ||
          item.projectName.toLowerCase().includes(query) ||
          `${item.submittedBy.firstName} ${item.submittedBy.lastName}`
            .toLowerCase()
            .includes(query)
      );
    }

    // Conflict filter
    if (filterBy === 'with_conflicts') {
      result = result.filter((item) => item.conflictsCount > 0);
    } else if (filterBy === 'no_conflicts') {
      result = result.filter((item) => item.conflictsCount === 0);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        case 'oldest':
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        case 'most_activities':
          return b.activitiesCount - a.activitiesCount;
        case 'most_conflicts':
          return b.conflictsCount - a.conflictsCount;
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, sortBy, filterBy]);

  // Stats
  const totalPending = items.length;
  const withConflicts = items.filter((i) => i.conflictsCount > 0).length;

  // Handlers
  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await onApprove(id);
      setSuccessMessage('Approved!');
      setShowSuccess(true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await onReject(id);
      setSuccessMessage('Rejected');
      setShowSuccess(true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSuccessComplete = () => {
    setShowSuccess(false);
    setSuccessMessage('');
  };

  // Render loading skeleton
  const renderSkeleton = () => (
    <>
      {[1, 2, 3].map((i) => (
        <Paper key={i} sx={{ mb: 2, p: 2, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Skeleton variant="circular" width={48} height={48} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={20} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Skeleton variant="text" width={80} />
            <Skeleton variant="text" width={60} />
          </Box>
        </Paper>
      ))}
    </>
  );

  // Render empty state
  const renderEmptyState = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 2,
        textAlign: 'center',
      }}
    >
      <EmptyIcon
        sx={{
          fontSize: 64,
          color: 'text.secondary',
          opacity: 0.5,
          mb: 2,
        }}
      />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        All caught up!
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {searchQuery || filterBy !== 'all'
          ? 'No approvals match your filters'
          : 'No pending approvals at this time'}
      </Typography>
      {(searchQuery || filterBy !== 'all') && (
        <Button
          variant="outlined"
          onClick={() => {
            setSearchQuery('');
            setFilterBy('all');
          }}
        >
          Clear Filters
        </Button>
      )}
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ px: isMobile ? 2 : 3, py: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight={600}>
              Approval Queue
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {totalPending} pending • {withConflicts} with conflicts
            </Typography>
          </Box>
          {onRefresh && (
            <IconButton onClick={onRefresh} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          )}
        </Box>

        {/* Search and Filters */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <TextField
            size="small"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
          />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                displayEmpty
                startAdornment={<FilterIcon fontSize="small" sx={{ mr: 0.5 }} />}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="with_conflicts">With Conflicts</MenuItem>
                <MenuItem value="no_conflicts">No Conflicts</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                displayEmpty
                startAdornment={<SortIcon fontSize="small" sx={{ mr: 0.5 }} />}
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="oldest">Oldest First</MenuItem>
                <MenuItem value="most_activities">Most Activities</MenuItem>
                <MenuItem value="most_conflicts">Most Conflicts</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* Progress indicator */}
      {filteredItems.length > 0 && (
        <Box
          sx={{
            px: isMobile ? 2 : 3,
            py: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Showing {filteredItems.length} of {totalPending}
          </Typography>
          {isMobile && (
            <Typography variant="caption" color="text.secondary">
              Swipe cards to approve/reject
            </Typography>
          )}
        </Box>
      )}

      {/* List */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: isMobile ? 2 : 3,
          py: 2,
        }}
      >
        {isLoading ? (
          renderSkeleton()
        ) : filteredItems.length === 0 ? (
          renderEmptyState()
        ) : (
          filteredItems.map((item) =>
            isMobile ? (
              <SwipeableApprovalCard
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
                onView={onView}
                isLoading={processingId === item.id}
              />
            ) : (
              <ApprovalCard
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
                onView={onView}
                isLoading={processingId === item.id}
              />
            )
          )
        )}
      </Box>

      {/* Success Animation */}
      <CommitSuccessAnimation
        show={showSuccess}
        onComplete={handleSuccessComplete}
        message={successMessage}
        size="small"
        autoDismissDelay={1000}
      />
    </Box>
  );
};

export default ApprovalQueueView;
