import React, { useEffect, useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Typography,
  Paper,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Compare as CompareIcon,
  History as HistoryIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAppDispatch, useAppSelector } from '@store/index';
import { fetchBaselines, createBaseline, selectBaseline } from '@store/slices/scheduleSlice';

// ============================================================================
// Types
// ============================================================================

interface BaselineSelectorProps {
  scheduleId: string;
  onCompare?: (baseline1Id: string, baseline2Id: string) => void;
}

// ============================================================================
// BaselineSelector Component
// ============================================================================

export const BaselineSelector: React.FC<BaselineSelectorProps> = ({ scheduleId, onCompare }) => {
  const dispatch = useAppDispatch();
  const { baselines, selectedBaselineId } = useAppSelector((state) => state.schedule);

  // Local state
  const [compareMode, setCompareMode] = useState(false);
  const [compareBaseline1, setCompareBaseline1] = useState<string>('');
  const [compareBaseline2, setCompareBaseline2] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch baselines on mount
  useEffect(() => {
    if (scheduleId) {
      dispatch(fetchBaselines(scheduleId));
    }
  }, [scheduleId, dispatch]);

  // Handlers
  const handleBaselineChange = (baselineId: string) => {
    dispatch(selectBaseline(baselineId || null));
  };

  const handleCreateBaseline = async () => {
    setCreating(true);
    setError(null);
    try {
      await dispatch(createBaseline(scheduleId)).unwrap();
      setCreateDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create baseline');
    } finally {
      setCreating(false);
    }
  };

  const handleCompare = () => {
    if (compareBaseline1 && compareBaseline2 && onCompare) {
      onCompare(compareBaseline1, compareBaseline2);
    }
  };

  const handleToggleCompareMode = () => {
    setCompareMode(!compareMode);
    if (!compareMode) {
      // Reset comparison selections when entering compare mode
      setCompareBaseline1(baselines[0]?.id || '');
      setCompareBaseline2(baselines[1]?.id || '');
    }
  };

  // Sort baselines by version (newest first)
  const sortedBaselines = [...baselines].sort((a, b) => b.version - a.version);

  if (baselines.length === 0) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="action" />
            <Typography variant="body2" color="text.secondary">
              No baselines saved. Create a baseline to track schedule changes over time.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Baseline
          </Button>
        </Stack>

        {/* Create Baseline Dialog */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
          <DialogTitle>Create Baseline</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Creating a baseline will save a snapshot of the current schedule. You can compare
              baselines later to track changes.
            </DialogContentText>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateBaseline}
              variant="contained"
              disabled={creating}
              startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
            >
              {creating ? 'Creating...' : 'Create Baseline'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* Baseline selector or comparison mode */}
        {!compareMode ? (
          <>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>View Baseline</InputLabel>
              <Select
                value={selectedBaselineId || ''}
                label="View Baseline"
                onChange={(e) => handleBaselineChange(e.target.value)}
              >
                <MenuItem value="">
                  <em>Current Schedule</em>
                </MenuItem>
                {sortedBaselines.map((baseline) => (
                  <MenuItem key={baseline.id} value={baseline.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        Baseline {baseline.version}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({format(new Date(baseline.createdAt), 'MMM dd, yyyy')})
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedBaselineId && (
              <Chip
                label={`Viewing Baseline ${sortedBaselines.find((b) => b.id === selectedBaselineId)?.version}`}
                onDelete={() => handleBaselineChange('')}
                color="primary"
                variant="outlined"
              />
            )}
          </>
        ) : (
          <>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Baseline 1</InputLabel>
              <Select
                value={compareBaseline1}
                label="Baseline 1"
                onChange={(e) => setCompareBaseline1(e.target.value)}
              >
                {sortedBaselines.map((baseline) => (
                  <MenuItem
                    key={baseline.id}
                    value={baseline.id}
                    disabled={baseline.id === compareBaseline2}
                  >
                    Baseline {baseline.version}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary">
              vs
            </Typography>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Baseline 2</InputLabel>
              <Select
                value={compareBaseline2}
                label="Baseline 2"
                onChange={(e) => setCompareBaseline2(e.target.value)}
              >
                {sortedBaselines.map((baseline) => (
                  <MenuItem
                    key={baseline.id}
                    value={baseline.id}
                    disabled={baseline.id === compareBaseline1}
                  >
                    Baseline {baseline.version}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="small"
              onClick={handleCompare}
              disabled={!compareBaseline1 || !compareBaseline2}
            >
              Compare
            </Button>
          </>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Actions */}
        <Stack direction="row" spacing={1}>
          {baselines.length >= 2 && (
            <Tooltip title={compareMode ? 'Exit Compare Mode' : 'Compare Baselines'}>
              <Button
                variant={compareMode ? 'contained' : 'outlined'}
                size="small"
                startIcon={<CompareIcon />}
                onClick={handleToggleCompareMode}
              >
                {compareMode ? 'Exit Compare' : 'Compare'}
              </Button>
            </Tooltip>
          )}

          <Tooltip
            title={
              baselines.length >= 5
                ? 'Maximum 5 baselines allowed. Creating a new one will remove the oldest.'
                : 'Create a new baseline'
            }
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Baseline
            </Button>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Baseline info */}
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <InfoIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary">
          {baselines.length} baseline{baselines.length !== 1 ? 's' : ''} saved (max 5).
          {baselines.length >= 5 && ' Creating a new baseline will remove the oldest one.'}
        </Typography>
      </Box>

      {/* Create Baseline Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>Create Baseline</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Creating a baseline will save a snapshot of the current schedule. This will be
            Baseline {(sortedBaselines[0]?.version || 0) + 1}.
            {baselines.length >= 5 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                You have 5 baselines. Creating a new one will remove Baseline{' '}
                {sortedBaselines[sortedBaselines.length - 1]?.version} (the oldest).
              </Alert>
            )}
          </DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateBaseline}
            variant="contained"
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {creating ? 'Creating...' : 'Create Baseline'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default BaselineSelector;
