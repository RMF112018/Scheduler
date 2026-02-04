import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Stack,
  Tabs,
  Tab,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { statusColors, ganttColors } from '../../theme';

// ============================================================================
// Types
// ============================================================================

interface ActivityVariance {
  activityId: string;
  activityName: string;
  activityCode?: string;
  isCritical: boolean;
  baseline1: {
    startDate: string;
    finishDate: string;
    duration: number;
    percentComplete: number;
  };
  baseline2: {
    startDate: string;
    finishDate: string;
    duration: number;
    percentComplete: number;
  };
  variance: {
    startDateDays: number;
    finishDateDays: number;
    durationDays: number;
    percentComplete: number;
  };
}

interface BaselineComparisonProps {
  baseline1Version: number;
  baseline2Version: number;
  variances: ActivityVariance[];
  loading?: boolean;
  error?: string | null;
}

type SortField = 'name' | 'startVariance' | 'finishVariance' | 'durationVariance';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'delayed' | 'accelerated' | 'unchanged' | 'critical';

// ============================================================================
// Utility Functions
// ============================================================================

const formatDate = (dateStr: string): string => {
  return format(new Date(dateStr), 'MMM dd, yyyy');
};

const getVarianceChip = (days: number, label: string) => {
  if (days > 0) {
    return (
      <Chip
        icon={<TrendingDownIcon sx={{ fontSize: 16 }} />}
        label={`+${days}d ${label}`}
        size="small"
        sx={{ bgcolor: statusColors.delayed, color: 'white' }}
      />
    );
  }
  if (days < 0) {
    return (
      <Chip
        icon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
        label={`${days}d ${label}`}
        size="small"
        sx={{ bgcolor: statusColors.completed, color: 'white' }}
      />
    );
  }
  return (
    <Chip
      icon={<TrendingFlatIcon sx={{ fontSize: 16 }} />}
      label="No change"
      size="small"
      variant="outlined"
    />
  );
};

const getVarianceColor = (days: number): string => {
  if (days > 0) return statusColors.delayed;
  if (days < 0) return statusColors.completed;
  return 'text.secondary';
};

// ============================================================================
// BaselineComparison Component
// ============================================================================

export const BaselineComparison: React.FC<BaselineComparisonProps> = ({
  baseline1Version,
  baseline2Version,
  variances,
  loading = false,
  error = null,
}) => {
  // State
  const [sortField, setSortField] = useState<SortField>('finishVariance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Summary stats
  const summary = useMemo(() => {
    const delayed = variances.filter((v) => v.variance.finishDateDays > 0);
    const accelerated = variances.filter((v) => v.variance.finishDateDays < 0);
    const unchanged = variances.filter((v) => v.variance.finishDateDays === 0);
    const criticalDelayed = delayed.filter((v) => v.isCritical);

    const totalDelayDays = delayed.reduce((sum, v) => sum + v.variance.finishDateDays, 0);
    const totalAcceleratedDays = accelerated.reduce((sum, v) => sum + Math.abs(v.variance.finishDateDays), 0);

    return {
      total: variances.length,
      delayed: delayed.length,
      accelerated: accelerated.length,
      unchanged: unchanged.length,
      criticalDelayed: criticalDelayed.length,
      totalDelayDays,
      totalAcceleratedDays,
      netVariance: totalDelayDays - totalAcceleratedDays,
    };
  }, [variances]);

  // Filtered and sorted variances
  const filteredVariances = useMemo(() => {
    let filtered = [...variances];

    // Apply filter
    switch (filter) {
      case 'delayed':
        filtered = filtered.filter((v) => v.variance.finishDateDays > 0);
        break;
      case 'accelerated':
        filtered = filtered.filter((v) => v.variance.finishDateDays < 0);
        break;
      case 'unchanged':
        filtered = filtered.filter((v) => v.variance.finishDateDays === 0);
        break;
      case 'critical':
        filtered = filtered.filter((v) => v.isCritical);
        break;
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.activityName.localeCompare(b.activityName);
          break;
        case 'startVariance':
          comparison = a.variance.startDateDays - b.variance.startDateDays;
          break;
        case 'finishVariance':
          comparison = a.variance.finishDateDays - b.variance.finishDateDays;
          break;
        case 'durationVariance':
          comparison = a.variance.durationDays - b.variance.durationDays;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [variances, filter, sortField, sortOrder]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleToggleExpand = (activityId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }} color="text.secondary">
          Loading comparison...
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  if (variances.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No variance data available</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          Baseline Comparison: Version {baseline1Version} → Version {baseline2Version}
        </Typography>

        {/* Summary Cards */}
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          <Paper sx={{ p: 1.5, minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">
              Total Activities
            </Typography>
            <Typography variant="h6">{summary.total}</Typography>
          </Paper>

          <Paper sx={{ p: 1.5, minWidth: 120, bgcolor: statusColors.delayed + '15' }}>
            <Typography variant="caption" color="text.secondary">
              Delayed
            </Typography>
            <Typography variant="h6" color="error">
              {summary.delayed}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              +{summary.totalDelayDays} days total
            </Typography>
          </Paper>

          <Paper sx={{ p: 1.5, minWidth: 120, bgcolor: statusColors.completed + '15' }}>
            <Typography variant="caption" color="text.secondary">
              Accelerated
            </Typography>
            <Typography variant="h6" color="success.main">
              {summary.accelerated}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              -{summary.totalAcceleratedDays} days total
            </Typography>
          </Paper>

          <Paper sx={{ p: 1.5, minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">
              Unchanged
            </Typography>
            <Typography variant="h6">{summary.unchanged}</Typography>
          </Paper>

          <Paper
            sx={{
              p: 1.5,
              minWidth: 140,
              bgcolor: summary.netVariance > 0 ? statusColors.delayed + '15' : statusColors.completed + '15',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Net Variance
            </Typography>
            <Typography
              variant="h6"
              color={summary.netVariance > 0 ? 'error' : summary.netVariance < 0 ? 'success.main' : 'text.primary'}
            >
              {summary.netVariance > 0 ? '+' : ''}
              {summary.netVariance} days
            </Typography>
          </Paper>

          {summary.criticalDelayed > 0 && (
            <Paper sx={{ p: 1.5, minWidth: 140, bgcolor: ganttColors.criticalPath + '15' }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <WarningIcon fontSize="small" color="error" />
                <Typography variant="caption" color="error">
                  Critical Path Impact
                </Typography>
              </Stack>
              <Typography variant="h6" color="error">
                {summary.criticalDelayed} activities
              </Typography>
            </Paper>
          )}
        </Stack>
      </Box>

      {/* Filter Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={filter}
          onChange={(_, newValue) => setFilter(newValue)}
          aria-label="variance filter tabs"
        >
          <Tab label={`All (${summary.total})`} value="all" />
          <Tab label={`Delayed (${summary.delayed})`} value="delayed" />
          <Tab label={`Accelerated (${summary.accelerated})`} value="accelerated" />
          <Tab label={`Unchanged (${summary.unchanged})`} value="unchanged" />
          <Tab
            label={`Critical Path (${variances.filter((v) => v.isCritical).length})`}
            value="critical"
          />
        </Tabs>
      </Box>

      {/* Variance Table */}
      <TableContainer sx={{ maxHeight: 500 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }}></TableCell>
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
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'startVariance'}
                  direction={sortField === 'startVariance' ? sortOrder : 'asc'}
                  onClick={() => handleSort('startVariance')}
                >
                  Start Variance
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'finishVariance'}
                  direction={sortField === 'finishVariance' ? sortOrder : 'asc'}
                  onClick={() => handleSort('finishVariance')}
                >
                  Finish Variance
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'durationVariance'}
                  direction={sortField === 'durationVariance' ? sortOrder : 'asc'}
                  onClick={() => handleSort('durationVariance')}
                >
                  Duration Variance
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Progress Change</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredVariances.map((variance) => (
              <React.Fragment key={variance.activityId}>
                <TableRow
                  hover
                  sx={{
                    bgcolor:
                      variance.variance.finishDateDays > 0
                        ? statusColors.delayed + '08'
                        : variance.variance.finishDateDays < 0
                        ? statusColors.completed + '08'
                        : 'inherit',
                  }}
                >
                  {/* Expand button */}
                  <TableCell sx={{ width: 40, px: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleExpand(variance.activityId)}
                    >
                      {expandedRows.has(variance.activityId) ? (
                        <ExpandLessIcon fontSize="small" />
                      ) : (
                        <ExpandMoreIcon fontSize="small" />
                      )}
                    </IconButton>
                  </TableCell>

                  {/* Critical indicator */}
                  <TableCell sx={{ width: 40, px: 1 }}>
                    {variance.isCritical && (
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
                      <Typography variant="body2" fontWeight={variance.isCritical ? 600 : 400}>
                        {variance.activityName}
                      </Typography>
                      {variance.activityCode && (
                        <Typography variant="caption" color="text.secondary">
                          {variance.activityCode}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>

                  {/* Start variance */}
                  <TableCell align="center">
                    <Typography
                      variant="body2"
                      color={getVarianceColor(variance.variance.startDateDays)}
                      fontWeight={variance.variance.startDateDays !== 0 ? 600 : 400}
                    >
                      {variance.variance.startDateDays > 0 ? '+' : ''}
                      {variance.variance.startDateDays}d
                    </Typography>
                  </TableCell>

                  {/* Finish variance */}
                  <TableCell align="center">
                    <Typography
                      variant="body2"
                      color={getVarianceColor(variance.variance.finishDateDays)}
                      fontWeight={variance.variance.finishDateDays !== 0 ? 600 : 400}
                    >
                      {variance.variance.finishDateDays > 0 ? '+' : ''}
                      {variance.variance.finishDateDays}d
                    </Typography>
                  </TableCell>

                  {/* Duration variance */}
                  <TableCell align="center">
                    <Typography
                      variant="body2"
                      color={getVarianceColor(variance.variance.durationDays)}
                      fontWeight={variance.variance.durationDays !== 0 ? 600 : 400}
                    >
                      {variance.variance.durationDays > 0 ? '+' : ''}
                      {variance.variance.durationDays}d
                    </Typography>
                  </TableCell>

                  {/* Progress change */}
                  <TableCell align="center">
                    <Typography
                      variant="body2"
                      color={
                        variance.variance.percentComplete > 0
                          ? 'success.main'
                          : variance.variance.percentComplete < 0
                          ? 'error'
                          : 'text.secondary'
                      }
                    >
                      {variance.variance.percentComplete > 0 ? '+' : ''}
                      {variance.variance.percentComplete}%
                    </Typography>
                  </TableCell>
                </TableRow>

                {/* Expanded details */}
                <TableRow>
                  <TableCell colSpan={7} sx={{ p: 0, borderBottom: 0 }}>
                    <Collapse in={expandedRows.has(variance.activityId)}>
                      <Box sx={{ p: 2, bgcolor: '#F8FAFC' }}>
                        <Stack direction="row" spacing={4}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                              Baseline {baseline1Version}
                            </Typography>
                            <Typography variant="body2">
                              Start: {formatDate(variance.baseline1.startDate)}
                            </Typography>
                            <Typography variant="body2">
                              Finish: {formatDate(variance.baseline1.finishDate)}
                            </Typography>
                            <Typography variant="body2">
                              Duration: {variance.baseline1.duration} days
                            </Typography>
                            <Typography variant="body2">
                              Progress: {variance.baseline1.percentComplete}%
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                              Baseline {baseline2Version}
                            </Typography>
                            <Typography variant="body2">
                              Start: {formatDate(variance.baseline2.startDate)}
                            </Typography>
                            <Typography variant="body2">
                              Finish: {formatDate(variance.baseline2.finishDate)}
                            </Typography>
                            <Typography variant="body2">
                              Duration: {variance.baseline2.duration} days
                            </Typography>
                            <Typography variant="body2">
                              Progress: {variance.baseline2.percentComplete}%
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                              Variance
                            </Typography>
                            {getVarianceChip(variance.variance.startDateDays, 'start')}
                            <Box sx={{ mt: 0.5 }}>
                              {getVarianceChip(variance.variance.finishDateDays, 'finish')}
                            </Box>
                          </Box>
                        </Stack>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}

            {filteredVariances.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No activities match the selected filter
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default BaselineComparison;
