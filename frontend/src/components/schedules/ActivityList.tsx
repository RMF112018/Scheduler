import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  InputAdornment,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Stack,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { statusColors, ganttColors } from '../../theme';
import type { Activity } from '@store/slices/activitySlice';

// ============================================================================
// Types
// ============================================================================

interface ActivityListProps {
  activities: Activity[];
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  onSelect: (activity: Activity) => void;
  selectedActivityId?: string | null;
  loading?: boolean;
}

type SortField = 'name' | 'startDate' | 'finishDate' | 'duration' | 'percentComplete';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'notStarted' | 'inProgress' | 'completed' | 'critical' | 'delayed';

// ============================================================================
// Utility Functions
// ============================================================================

const formatDate = (dateStr: string | Date): string => {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return format(date, 'MMM dd, yyyy');
};

const getStatusChip = (activity: Activity) => {
  if (activity.percentComplete === 100) {
    return (
      <Chip
        icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
        label="Complete"
        size="small"
        sx={{ bgcolor: statusColors.completed, color: 'white' }}
      />
    );
  }
  if (activity.isDelayed) {
    return (
      <Chip
        icon={<WarningIcon sx={{ fontSize: 16 }} />}
        label="Delayed"
        size="small"
        sx={{ bgcolor: statusColors.delayed, color: 'white' }}
      />
    );
  }
  if (activity.isAtRisk) {
    return (
      <Chip
        icon={<WarningIcon sx={{ fontSize: 16 }} />}
        label="At Risk"
        size="small"
        sx={{ bgcolor: statusColors.atRisk, color: 'white' }}
      />
    );
  }
  if (activity.percentComplete > 0) {
    return (
      <Chip
        icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
        label="In Progress"
        size="small"
        sx={{ bgcolor: statusColors.inProgress, color: 'white' }}
      />
    );
  }
  return (
    <Chip
      label="Not Started"
      size="small"
      sx={{ bgcolor: statusColors.notStarted, color: 'white' }}
    />
  );
};

// ============================================================================
// ActivityList Component
// ============================================================================

export const ActivityList: React.FC<ActivityListProps> = ({
  activities,
  onEdit,
  onDelete,
  onSelect,
  selectedActivityId,
  loading = false,
}) => {
  // State
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuActivity, setMenuActivity] = useState<Activity | null>(null);

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    let filtered = [...activities];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(searchLower) ||
          a.activityCode?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    switch (statusFilter) {
      case 'notStarted':
        filtered = filtered.filter((a) => a.percentComplete === 0);
        break;
      case 'inProgress':
        filtered = filtered.filter((a) => a.percentComplete > 0 && a.percentComplete < 100);
        break;
      case 'completed':
        filtered = filtered.filter((a) => a.percentComplete === 100);
        break;
      case 'critical':
        filtered = filtered.filter((a) => a.isCritical);
        break;
      case 'delayed':
        filtered = filtered.filter((a) => a.isDelayed);
        break;
    }

    // Sort
    filtered.sort((a, b) => {
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
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [activities, search, statusFilter, sortField, sortOrder]);

  // Paginated activities
  const paginatedActivities = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredActivities.slice(start, start + rowsPerPage);
  }, [filteredActivities, page, rowsPerPage]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, activity: Activity) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuActivity(activity);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuActivity(null);
  };

  const handleEdit = () => {
    if (menuActivity) {
      onEdit(menuActivity);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (menuActivity) {
      onDelete(menuActivity);
    }
    handleMenuClose();
  };

  const handleStatusFilterChange = (event: SelectChangeEvent<StatusFilter>) => {
    setStatusFilter(event.target.value as StatusFilter);
    setPage(0);
  };

  // Stats
  const stats = useMemo(() => {
    const total = activities.length;
    const completed = activities.filter((a) => a.percentComplete === 100).length;
    const inProgress = activities.filter((a) => a.percentComplete > 0 && a.percentComplete < 100).length;
    const critical = activities.filter((a) => a.isCritical).length;
    const delayed = activities.filter((a) => a.isDelayed).length;
    return { total, completed, inProgress, critical, delayed };
  }, [activities]);

  if (activities.length === 0 && !loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No activities in this schedule</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ width: '100%' }}>
      {/* Toolbar */}
      <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search activities..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ minWidth: 250 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={handleStatusFilterChange}
          >
            <MenuItem value="all">All Activities</MenuItem>
            <MenuItem value="notStarted">Not Started</MenuItem>
            <MenuItem value="inProgress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="critical">Critical Path</MenuItem>
            <MenuItem value="delayed">Delayed</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1}>
          <Chip label={`${stats.total} Total`} size="small" variant="outlined" />
          <Chip
            label={`${stats.completed} Complete`}
            size="small"
            sx={{ bgcolor: statusColors.completed, color: 'white' }}
          />
          <Chip
            label={`${stats.critical} Critical`}
            size="small"
            sx={{ bgcolor: ganttColors.criticalPath, color: 'white' }}
          />
          {stats.delayed > 0 && (
            <Chip
              label={`${stats.delayed} Delayed`}
              size="small"
              sx={{ bgcolor: statusColors.delayed, color: 'white' }}
            />
          )}
        </Stack>
      </Box>

      {/* Loading indicator */}
      {loading && <LinearProgress />}

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }}></TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'name'}
                  direction={sortField === 'name' ? sortOrder : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Activity
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'startDate'}
                  direction={sortField === 'startDate' ? sortOrder : 'asc'}
                  onClick={() => handleSort('startDate')}
                >
                  Start
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'finishDate'}
                  direction={sortField === 'finishDate' ? sortOrder : 'asc'}
                  onClick={() => handleSort('finishDate')}
                >
                  Finish
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'duration'}
                  direction={sortField === 'duration' ? sortOrder : 'asc'}
                  onClick={() => handleSort('duration')}
                >
                  Duration
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'percentComplete'}
                  direction={sortField === 'percentComplete' ? sortOrder : 'asc'}
                  onClick={() => handleSort('percentComplete')}
                >
                  Progress
                </TableSortLabel>
              </TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Links</TableCell>
              <TableCell align="right" sx={{ width: 60 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedActivities.map((activity) => (
              <TableRow
                key={activity.id}
                hover
                selected={activity.id === selectedActivityId}
                onClick={() => onSelect(activity)}
                sx={{
                  cursor: 'pointer',
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                  },
                }}
              >
                {/* Critical path indicator */}
                <TableCell sx={{ width: 40, px: 1 }}>
                  {activity.isCritical && (
                    <Tooltip title="Critical Path">
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: ganttColors.criticalPath,
                        }}
                      />
                    </Tooltip>
                  )}
                </TableCell>

                {/* Activity name */}
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight={activity.isCritical ? 600 : 400}>
                      {activity.name}
                    </Typography>
                    {activity.activityCode && (
                      <Typography variant="caption" color="text.secondary">
                        {activity.activityCode}
                      </Typography>
                    )}
                  </Box>
                </TableCell>

                {/* Start date */}
                <TableCell>
                  <Typography variant="body2">{formatDate(activity.startDate)}</Typography>
                </TableCell>

                {/* Finish date */}
                <TableCell>
                  <Typography variant="body2">{formatDate(activity.finishDate)}</Typography>
                </TableCell>

                {/* Duration */}
                <TableCell align="center">
                  <Typography variant="body2">{activity.duration}d</Typography>
                </TableCell>

                {/* Progress */}
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 60 }}>
                      <LinearProgress
                        variant="determinate"
                        value={activity.percentComplete}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            bgcolor:
                              activity.percentComplete === 100
                                ? statusColors.completed
                                : activity.isDelayed
                                ? statusColors.delayed
                                : 'primary.main',
                          },
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ minWidth: 35 }}>
                      {activity.percentComplete}%
                    </Typography>
                  </Box>
                </TableCell>

                {/* Status */}
                <TableCell>{getStatusChip(activity)}</TableCell>

                {/* Links */}
                <TableCell align="center">
                  {(activity.predecessorIds.length > 0 || activity.successorIds.length > 0) && (
                    <Tooltip
                      title={`${activity.predecessorIds.length} predecessor(s), ${activity.successorIds.length} successor(s)`}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <LinkIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {activity.predecessorIds.length + activity.successorIds.length}
                        </Typography>
                      </Box>
                    </Tooltip>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, activity)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}

            {paginatedActivities.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {search || statusFilter !== 'all'
                      ? 'No activities match your filters'
                      : 'No activities found'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={filteredActivities.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Activity</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Activity</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default ActivityList;
