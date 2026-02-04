import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@store/index';
import { fetchSchedule } from '@store/slices/scheduleSlice';
import {
  fetchActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  selectActivity,
} from '@store/slices/activitySlice';
import GanttChart from './GanttChart';
import ActivityList from './ActivityList';
import ActivityForm, { ActivityFormData } from './ActivityForm';
import type { Activity } from '@store/slices/activitySlice';

// ============================================================================
// Types
// ============================================================================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// ============================================================================
// TabPanel Component
// ============================================================================

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`schedule-tabpanel-${index}`}
      aria-labelledby={`schedule-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index && children}
    </Box>
  );
};

// ============================================================================
// ScheduleDetail Component
// ============================================================================

const ScheduleDetail: React.FC = () => {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const dispatch = useAppDispatch();
  const { currentSchedule, loading: scheduleLoading } = useAppSelector((state) => state.schedule);
  const { activities, loading: activitiesLoading, selectedActivityId } = useAppSelector(
    (state) => state.activity
  );

  // Local state
  const [tabValue, setTabValue] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch schedule and activities on mount
  useEffect(() => {
    if (scheduleId) {
      dispatch(fetchSchedule(scheduleId));
      dispatch(fetchActivities(scheduleId));
    }
  }, [scheduleId, dispatch]);

  // Handlers
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRefresh = useCallback(() => {
    if (scheduleId) {
      dispatch(fetchSchedule(scheduleId));
      dispatch(fetchActivities(scheduleId));
    }
  }, [scheduleId, dispatch]);

  const handleAddActivity = () => {
    setEditingActivity(null);
    setFormMode('create');
    setFormOpen(true);
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleDeleteActivity = (activity: Activity) => {
    setDeletingActivity(activity);
    setDeleteDialogOpen(true);
  };

  const handleSelectActivity = (activity: Activity) => {
    dispatch(selectActivity(activity.id));
  };

  const handleActivityClick = (activity: Activity) => {
    dispatch(selectActivity(activity.id));
  };

  const handleActivityDoubleClick = (activity: Activity) => {
    handleEditActivity(activity);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingActivity(null);
  };

  const handleFormSave = async (data: ActivityFormData) => {
    try {
      // Convert Date objects to ISO strings for the API
      const apiData = {
        ...data,
        startDate: data.startDate.toISOString(),
        finishDate: data.finishDate.toISOString(),
      };

      if (formMode === 'create') {
        await dispatch(createActivity(apiData)).unwrap();
        setSnackbar({ open: true, message: 'Activity created successfully', severity: 'success' });
      } else if (editingActivity) {
        await dispatch(updateActivity({ id: editingActivity.id, data: apiData })).unwrap();
        setSnackbar({ open: true, message: 'Activity updated successfully', severity: 'success' });
      }
      handleFormClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save activity';
      setSnackbar({ open: true, message, severity: 'error' });
      throw error;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingActivity) return;

    try {
      await dispatch(deleteActivity(deletingActivity.id)).unwrap();
      setSnackbar({ open: true, message: 'Activity deleted successfully', severity: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete activity';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingActivity(null);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Loading state
  if (scheduleLoading || activitiesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Not found state
  if (!currentSchedule) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Schedule not found</Alert>
      </Box>
    );
  }

  // Calculate stats
  const stats = {
    total: activities.length,
    completed: activities.filter((a) => a.percentComplete === 100).length,
    inProgress: activities.filter((a) => a.percentComplete > 0 && a.percentComplete < 100).length,
    critical: activities.filter((a) => a.isCritical).length,
    delayed: activities.filter((a) => a.isDelayed).length,
  };

  const completionPercentage =
    stats.total > 0
      ? Math.round(activities.reduce((sum, a) => sum + a.percentComplete, 0) / stats.total)
      : 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight={600}>
        {currentSchedule.name}
      </Typography>
      {currentSchedule.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {currentSchedule.description}
        </Typography>
      )}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={`${stats.total} Activities`}
              variant="outlined"
              size="small"
            />
            <Chip
              label={`${completionPercentage}% Complete`}
              size="small"
              color={completionPercentage === 100 ? 'success' : 'default'}
            />
            {stats.critical > 0 && (
              <Chip
                label={`${stats.critical} Critical`}
                size="small"
                color="error"
              />
            )}
            {stats.delayed > 0 && (
              <Chip
                label={`${stats.delayed} Delayed`}
                size="small"
                color="warning"
              />
            )}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddActivity}
          >
            Add Activity
          </Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="schedule views">
          <Tab
            icon={<TimelineIcon />}
            iconPosition="start"
            label="Gantt Chart"
            id="schedule-tab-0"
            aria-controls="schedule-tabpanel-0"
          />
          <Tab
            icon={<TableChartIcon />}
            iconPosition="start"
            label="Activity List"
            id="schedule-tab-1"
            aria-controls="schedule-tabpanel-1"
          />
        </Tabs>
              </Box>

      {/* Gantt Chart Tab */}
      <TabPanel value={tabValue} index={0}>
        <GanttChart
          activities={activities}
          onActivityClick={handleActivityClick}
          onActivityDoubleClick={handleActivityDoubleClick}
          selectedActivityId={selectedActivityId}
          showCriticalPath
          showProgress
        />
      </TabPanel>

      {/* Activity List Tab */}
      <TabPanel value={tabValue} index={1}>
        <ActivityList
          activities={activities}
          onEdit={handleEditActivity}
          onDelete={handleDeleteActivity}
          onSelect={handleSelectActivity}
          selectedActivityId={selectedActivityId}
          loading={activitiesLoading}
        />
      </TabPanel>

      {/* Activity Form Dialog */}
      {scheduleId && (
        <ActivityForm
          open={formOpen}
          onClose={handleFormClose}
          onSave={handleFormSave}
          activity={editingActivity}
          scheduleId={scheduleId}
          activities={activities}
          mode={formMode}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Delete Activity</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete "{deletingActivity?.name}"? This action cannot be undone.
            {deletingActivity?.isCritical && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This activity is on the critical path. Deleting it may affect your project schedule.
              </Alert>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ScheduleDetail;
