import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Button,
  LinearProgress,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
  Collapse,
  Card,
  CardContent,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Clear as ClearIcon,
  Done as DoneIcon,
  Flag as FlagIcon,
} from '@mui/icons-material';
import type { LookaheadActivity } from '@store/slices/lookaheadSlice';

// Props interface
interface TaskListViewProps {
  activities: LookaheadActivity[];
  onActivityClick?: (activityId: string) => void;
  onStatusChange?: (activityId: string, status: 'should_do' | 'will_do') => void;
  onBulkStatusChange?: (activityIds: string[], status: 'should_do' | 'will_do') => void;
  isLoading?: boolean;
}

// Sort configuration
type SortField = 'name' | 'startDate' | 'finishDate' | 'duration' | 'percentComplete' | 'status';
type SortDirection = 'asc' | 'desc';

// Filter options
type StatusFilter = 'all' | 'should_do' | 'will_do' | 'not_set' | 'has_conflict' | 'committed';

// Format date for display
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

// Get days until/since date
const getDaysFromNow = (dateString: string): number => {
  const date = new Date(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Get status display info
const getStatusInfo = (activity: LookaheadActivity) => {
  if (activity.hasConflict) {
    return {
      label: 'Conflict',
      color: 'error' as const,
      icon: <WarningIcon fontSize="small" />,
    };
  }
  if (activity.isCommitted) {
    return {
      label: 'Committed',
      color: 'primary' as const,
      icon: <DoneIcon fontSize="small" />,
    };
  }
  switch (activity.plannerStatus) {
    case 'will_do':
      return {
        label: 'Will Do',
        color: 'success' as const,
        icon: <CheckIcon fontSize="small" />,
      };
    case 'should_do':
      return {
        label: 'Should Do',
        color: 'warning' as const,
        icon: <ScheduleIcon fontSize="small" />,
      };
    default:
      return {
        label: 'Not Set',
        color: 'default' as const,
        icon: null,
      };
  }
};

// Progress color
const getProgressColor = (percent: number): 'success' | 'info' | 'primary' | 'warning' | 'inherit' => {
  if (percent >= 100) return 'success';
  if (percent >= 75) return 'info';
  if (percent >= 50) return 'primary';
  if (percent >= 25) return 'warning';
  return 'inherit';
};

const TaskListView: React.FC<TaskListViewProps> = ({
  activities,
  onActivityClick,
  onStatusChange,
  onBulkStatusChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(!isMobile);

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    let result = [...activities];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((activity) =>
        activity.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    switch (statusFilter) {
      case 'should_do':
        result = result.filter((a) => a.plannerStatus === 'should_do');
        break;
      case 'will_do':
        result = result.filter((a) => a.plannerStatus === 'will_do');
        break;
      case 'not_set':
        result = result.filter((a) => !a.plannerStatus);
        break;
      case 'has_conflict':
        result = result.filter((a) => a.hasConflict);
        break;
      case 'committed':
        result = result.filter((a) => a.isCommitted);
        break;
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'startDate':
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case 'finishDate':
          comparison = new Date(a.finishDate).getTime() - new Date(b.finishDate).getTime();
          break;
        case 'duration':
          comparison = a.duration - b.duration;
          break;
        case 'percentComplete':
          comparison = a.percentComplete - b.percentComplete;
          break;
        case 'status':
          const statusOrder = { will_do: 0, should_do: 1, null: 2 };
          const aOrder = statusOrder[a.plannerStatus || 'null'] ?? 2;
          const bOrder = statusOrder[b.plannerStatus || 'null'] ?? 2;
          comparison = aOrder - bOrder;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [activities, searchTerm, statusFilter, sortField, sortDirection]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle selection
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(filteredActivities.map((a) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (activityId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(activityId)) {
      newSelected.delete(activityId);
    } else {
      newSelected.add(activityId);
    }
    setSelectedIds(newSelected);
  };

  // Handle bulk actions
  const handleBulkAction = (status: 'should_do' | 'will_do') => {
    if (onBulkStatusChange && selectedIds.size > 0) {
      onBulkStatusChange(Array.from(selectedIds), status);
      setSelectedIds(new Set());
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  // Render mobile card view
  const renderMobileCard = (activity: LookaheadActivity) => {
    const statusInfo = getStatusInfo(activity);
    const daysUntilStart = getDaysFromNow(activity.startDate);
    const daysUntilFinish = getDaysFromNow(activity.finishDate);
    const isOverdue = daysUntilFinish < 0 && activity.percentComplete < 100;

    return (
      <Card
        key={activity.id}
        sx={{
          mb: 1.5,
          border: '1px solid',
          borderColor: activity.hasConflict ? 'error.main' : 'divider',
          bgcolor: activity.hasConflict ? alpha(theme.palette.error.main, 0.05) : 'background.paper',
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Checkbox
                checked={selectedIds.has(activity.id)}
                onChange={() => handleSelectOne(activity.id)}
                size="small"
              />
              <Typography
                variant="body1"
                fontWeight={600}
                onClick={() => onActivityClick?.(activity.id)}
                sx={{ cursor: onActivityClick ? 'pointer' : 'default' }}
              >
                {activity.name}
              </Typography>
            </Box>
            <Chip
              icon={statusInfo.icon || undefined}
              label={statusInfo.label}
              size="small"
              color={statusInfo.color}
              variant={activity.hasConflict ? 'filled' : 'outlined'}
            />
          </Box>

          {/* Progress */}
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" fontWeight={500}>
                {activity.percentComplete}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={activity.percentComplete}
              color={getProgressColor(activity.percentComplete)}
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Box>

          {/* Details */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`Start: ${formatDate(activity.startDate)}`}
              size="small"
              variant="outlined"
              color={daysUntilStart === 0 ? 'warning' : 'default'}
              sx={{ height: 24 }}
            />
            <Chip
              label={`End: ${formatDate(activity.finishDate)}`}
              size="small"
              variant="outlined"
              color={isOverdue ? 'error' : 'default'}
              sx={{ height: 24 }}
            />
            <Chip
              label={`${activity.duration}d`}
              size="small"
              variant="outlined"
              sx={{ height: 24 }}
            />
          </Box>

          {/* Actions */}
          {onStatusChange && !activity.isCommitted && (
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button
                variant={activity.plannerStatus === 'should_do' ? 'contained' : 'outlined'}
                color="warning"
                size="small"
                onClick={() => onStatusChange(activity.id, 'should_do')}
                startIcon={<ScheduleIcon />}
                sx={{ flex: 1 }}
              >
                Should Do
              </Button>
              <Button
                variant={activity.plannerStatus === 'will_do' ? 'contained' : 'outlined'}
                color="success"
                size="small"
                onClick={() => onStatusChange(activity.id, 'will_do')}
                startIcon={<CheckIcon />}
                sx={{ flex: 1 }}
              >
                Will Do
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Task List ({filteredActivities.length})
          </Typography>
          <IconButton
            onClick={() => setShowFilters(!showFilters)}
            color={showFilters ? 'primary' : 'default'}
          >
            <FilterIcon />
          </IconButton>
        </Box>

        {/* Filters */}
        <Collapse in={showFilters}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="will_do">Will Do</MenuItem>
                <MenuItem value="should_do">Should Do</MenuItem>
                <MenuItem value="not_set">Not Set</MenuItem>
                <MenuItem value="has_conflict">Has Conflict</MenuItem>
                <MenuItem value="committed">Committed</MenuItem>
              </Select>
            </FormControl>
            {(searchTerm || statusFilter !== 'all') && (
              <Button
                variant="outlined"
                size="small"
                onClick={clearFilters}
                startIcon={<ClearIcon />}
              >
                Clear
              </Button>
            )}
          </Box>
        </Collapse>

        {/* Bulk actions */}
        {selectedIds.size > 0 && onBulkStatusChange && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 1.5,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" fontWeight={500}>
              {selectedIds.size} selected
            </Typography>
            <Button
              variant="contained"
              color="warning"
              size="small"
              onClick={() => handleBulkAction('should_do')}
              startIcon={<ScheduleIcon />}
            >
              Mark Should Do
            </Button>
            <Button
              variant="contained"
              color="success"
              size="small"
              onClick={() => handleBulkAction('will_do')}
              startIcon={<CheckIcon />}
            >
              Mark Will Do
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </Button>
          </Box>
        )}
      </Box>

      {/* Content */}
      {isMobile ? (
        // Mobile card view
        <Box sx={{ p: 2 }}>
          {filteredActivities.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
              No activities match your filters
            </Typography>
          ) : (
            filteredActivities.map(renderMobileCard)
          )}
        </Box>
      ) : (
        // Desktop table view
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedIds.size > 0 && selectedIds.size < filteredActivities.length
                    }
                    checked={
                      filteredActivities.length > 0 &&
                      selectedIds.size === filteredActivities.length
                    }
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    Activity
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSort('status')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'startDate'}
                    direction={sortField === 'startDate' ? sortDirection : 'asc'}
                    onClick={() => handleSort('startDate')}
                  >
                    Start
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'finishDate'}
                    direction={sortField === 'finishDate' ? sortDirection : 'asc'}
                    onClick={() => handleSort('finishDate')}
                  >
                    Finish
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'duration'}
                    direction={sortField === 'duration' ? sortDirection : 'asc'}
                    onClick={() => handleSort('duration')}
                  >
                    Duration
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'percentComplete'}
                    direction={sortField === 'percentComplete' ? sortDirection : 'asc'}
                    onClick={() => handleSort('percentComplete')}
                  >
                    Progress
                  </TableSortLabel>
                </TableCell>
                {onStatusChange && <TableCell>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={onStatusChange ? 8 : 7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No activities match your filters
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredActivities.map((activity) => {
                  const statusInfo = getStatusInfo(activity);
                  const daysUntilStart = getDaysFromNow(activity.startDate);
                  const daysUntilFinish = getDaysFromNow(activity.finishDate);
                  const isOverdue = daysUntilFinish < 0 && activity.percentComplete < 100;

                  return (
                    <TableRow
                      key={activity.id}
                      hover
                      selected={selectedIds.has(activity.id)}
                      sx={{
                        bgcolor: activity.hasConflict
                          ? alpha(theme.palette.error.main, 0.05)
                          : 'inherit',
                        '&:hover': {
                          bgcolor: activity.hasConflict
                            ? alpha(theme.palette.error.main, 0.1)
                            : undefined,
                        },
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(activity.id)}
                          onChange={() => handleSelectOne(activity.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box
                          onClick={() => onActivityClick?.(activity.id)}
                          sx={{
                            cursor: onActivityClick ? 'pointer' : 'default',
                            '&:hover': onActivityClick
                              ? { textDecoration: 'underline' }
                              : undefined,
                          }}
                        >
                          <Typography variant="body2" fontWeight={500}>
                            {activity.name}
                          </Typography>
                          {activity.hasPostCommitTweaks && (
                            <Chip
                              icon={<FlagIcon />}
                              label="Modified"
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem', mt: 0.5 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={statusInfo.icon || undefined}
                          label={statusInfo.label}
                          size="small"
                          color={statusInfo.color}
                          variant={activity.hasConflict ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={daysUntilStart === 0 ? 'warning.main' : 'inherit'}
                          fontWeight={daysUntilStart === 0 ? 600 : 400}
                        >
                          {formatDate(activity.startDate)}
                        </Typography>
                        {daysUntilStart === 0 && (
                          <Typography variant="caption" color="warning.main">
                            Today
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={isOverdue ? 'error.main' : 'inherit'}
                          fontWeight={isOverdue ? 600 : 400}
                        >
                          {formatDate(activity.finishDate)}
                        </Typography>
                        {isOverdue && (
                          <Typography variant="caption" color="error.main">
                            Overdue
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{activity.duration}d</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={activity.percentComplete}
                            color={getProgressColor(activity.percentComplete)}
                            sx={{ flex: 1, height: 6, borderRadius: 1, minWidth: 60 }}
                          />
                          <Typography variant="caption" sx={{ minWidth: 35 }}>
                            {activity.percentComplete}%
                          </Typography>
                        </Box>
                      </TableCell>
                      {onStatusChange && (
                        <TableCell>
                          {!activity.isCommitted && (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="Mark as Should Do">
                                <IconButton
                                  size="small"
                                  color={
                                    activity.plannerStatus === 'should_do'
                                      ? 'warning'
                                      : 'default'
                                  }
                                  onClick={() => onStatusChange(activity.id, 'should_do')}
                                >
                                  <ScheduleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Mark as Will Do">
                                <IconButton
                                  size="small"
                                  color={
                                    activity.plannerStatus === 'will_do'
                                      ? 'success'
                                      : 'default'
                                  }
                                  onClick={() => onStatusChange(activity.id, 'will_do')}
                                >
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Summary footer */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          bgcolor: 'grey.50',
          borderTop: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<CheckIcon />}
            label={`${activities.filter((a) => a.plannerStatus === 'will_do').length} Will Do`}
            size="small"
            color="success"
            variant="outlined"
          />
          <Chip
            icon={<ScheduleIcon />}
            label={`${activities.filter((a) => a.plannerStatus === 'should_do').length} Should Do`}
            size="small"
            color="warning"
            variant="outlined"
          />
          <Chip
            icon={<WarningIcon />}
            label={`${activities.filter((a) => a.hasConflict).length} Conflicts`}
            size="small"
            color="error"
            variant="outlined"
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Showing {filteredActivities.length} of {activities.length} activities
        </Typography>
      </Box>
    </Paper>
  );
};

export default TaskListView;
