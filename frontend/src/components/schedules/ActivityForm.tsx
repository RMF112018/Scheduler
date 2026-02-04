import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Chip,
  Box,
  Typography,
  Slider,
  Alert,
  Autocomplete,
  IconButton,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { differenceInDays, addDays, isBefore } from 'date-fns';
import type { Activity } from '@store/slices/activitySlice';

// ============================================================================
// Types
// ============================================================================

interface ActivityFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ActivityFormData) => Promise<void>;
  activity?: Activity | null;
  scheduleId: string;
  activities: Activity[];
  mode: 'create' | 'edit';
}

export interface ActivityFormData {
  scheduleId: string;
  name: string;
  activityCode?: string;
  startDate: Date;
  finishDate: Date;
  duration: number;
  percentComplete: number;
  predecessorIds: string[];
  successorIds: string[];
  resourceIds: string[];
  metadata?: Record<string, unknown>;
}

interface FormErrors {
  name?: string;
  startDate?: string;
  finishDate?: string;
  duration?: string;
  general?: string;
}

// ============================================================================
// ActivityForm Component
// ============================================================================

export const ActivityForm: React.FC<ActivityFormProps> = ({
  open,
  onClose,
  onSave,
  activity,
  scheduleId,
  activities,
  mode,
}) => {
  // Form state
  const [name, setName] = useState('');
  const [activityCode, setActivityCode] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [finishDate, setFinishDate] = useState<Date | null>(addDays(new Date(), 5));
  const [duration, setDuration] = useState(5);
  const [percentComplete, setPercentComplete] = useState(0);
  const [predecessorIds, setPredecessorIds] = useState<string[]>([]);
  const [successorIds, setSuccessorIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Available activities for predecessor/successor selection (exclude current activity)
  const availableActivities = useMemo(() => {
    return activities.filter((a) => a.id !== activity?.id);
  }, [activities, activity?.id]);

  // Initialize form when activity changes
  useEffect(() => {
    if (activity && mode === 'edit') {
      setName(activity.name);
      setActivityCode(activity.activityCode || '');
      setStartDate(new Date(activity.startDate));
      setFinishDate(new Date(activity.finishDate));
      setDuration(activity.duration);
      setPercentComplete(activity.percentComplete);
      setPredecessorIds(activity.predecessorIds || []);
      setSuccessorIds(activity.successorIds || []);
    } else {
      // Reset form for create mode
      setName('');
      setActivityCode('');
      setStartDate(new Date());
      setFinishDate(addDays(new Date(), 5));
      setDuration(5);
      setPercentComplete(0);
      setPredecessorIds([]);
      setSuccessorIds([]);
    }
    setErrors({});
  }, [activity, mode, open]);

  // Update finish date when start date or duration changes
  useEffect(() => {
    if (startDate && duration > 0) {
      setFinishDate(addDays(startDate, duration));
    }
  }, [startDate, duration]);

  // Update duration when finish date changes
  const handleFinishDateChange = (date: Date | null) => {
    if (date && startDate) {
      const newDuration = differenceInDays(date, startDate);
      if (newDuration > 0) {
        setDuration(newDuration);
        setFinishDate(date);
      }
    }
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Activity name is required';
    }

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!finishDate) {
      newErrors.finishDate = 'Finish date is required';
    }

    if (startDate && finishDate && !isBefore(startDate, finishDate)) {
      newErrors.finishDate = 'Finish date must be after start date';
    }

    if (duration <= 0) {
      newErrors.duration = 'Duration must be greater than 0';
    }

    // Check for circular dependencies
    if (predecessorIds.some((id) => successorIds.includes(id))) {
      newErrors.general = 'An activity cannot be both a predecessor and successor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate() || !startDate || !finishDate) return;

    setSaving(true);
    try {
      await onSave({
        scheduleId,
        name: name.trim(),
        activityCode: activityCode.trim() || undefined,
        startDate,
        finishDate,
        duration,
        percentComplete,
        predecessorIds,
        successorIds,
        resourceIds: [],
      });
      onClose();
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : 'Failed to save activity',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>
            {mode === 'create' ? 'Create New Activity' : 'Edit Activity'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 3 }}>
          {errors.general && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errors.general}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Basic Information
              </Typography>
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField
                label="Activity Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                error={!!errors.name}
                helperText={errors.name}
                placeholder="e.g., Foundation Excavation"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Activity Code"
                value={activityCode}
                onChange={(e) => setActivityCode(e.target.value)}
                fullWidth
                placeholder="e.g., A1001"
                helperText="Optional identifier"
              />
            </Grid>

            {/* Dates and Duration */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                Schedule
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(date) => setStartDate(date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: !!errors.startDate,
                    helperText: errors.startDate,
                  },
                }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <DatePicker
                label="Finish Date"
                value={finishDate}
                onChange={handleFinishDateChange}
                minDate={startDate || undefined}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: !!errors.finishDate,
                    helperText: errors.finishDate,
                  },
                }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Duration (days)"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                fullWidth
                required
                error={!!errors.duration}
                helperText={errors.duration}
                inputProps={{ min: 1 }}
              />
            </Grid>

            {/* Progress */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                Progress
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ px: 1 }}>
                <Typography variant="body2" gutterBottom>
                  Percent Complete: {percentComplete}%
                </Typography>
                <Slider
                  value={percentComplete}
                  onChange={(_, value) => setPercentComplete(value as number)}
                  valueLabelDisplay="auto"
                  step={5}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 25, label: '25%' },
                    { value: 50, label: '50%' },
                    { value: 75, label: '75%' },
                    { value: 100, label: '100%' },
                  ]}
                  min={0}
                  max={100}
                  sx={{
                    '& .MuiSlider-markLabel': {
                      fontSize: '0.75rem',
                    },
                  }}
                />
              </Box>
            </Grid>

            {/* Dependencies */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                Dependencies
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                multiple
                options={availableActivities}
                getOptionLabel={(option) => option.name}
                value={availableActivities.filter((a) => predecessorIds.includes(a.id))}
                onChange={(_, newValue) => {
                  setPredecessorIds(newValue.map((a) => a.id));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Predecessors"
                    placeholder="Select predecessors..."
                    helperText="Activities that must complete before this one starts"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={option.name.length > 20 ? option.name.substring(0, 20) + '...' : option.name}
                      size="small"
                    />
                  ))
                }
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={(options, { inputValue }) => {
                  return options.filter(
                    (option) =>
                      option.name.toLowerCase().includes(inputValue.toLowerCase()) &&
                      !successorIds.includes(option.id)
                  );
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                multiple
                options={availableActivities}
                getOptionLabel={(option) => option.name}
                value={availableActivities.filter((a) => successorIds.includes(a.id))}
                onChange={(_, newValue) => {
                  setSuccessorIds(newValue.map((a) => a.id));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Successors"
                    placeholder="Select successors..."
                    helperText="Activities that can start after this one completes"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={option.name.length > 20 ? option.name.substring(0, 20) + '...' : option.name}
                      size="small"
                    />
                  ))
                }
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={(options, { inputValue }) => {
                  return options.filter(
                    (option) =>
                      option.name.toLowerCase().includes(inputValue.toLowerCase()) &&
                      !predecessorIds.includes(option.id)
                  );
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={mode === 'create' ? <AddIcon /> : <SaveIcon />}
          >
            {saving ? 'Saving...' : mode === 'create' ? 'Create Activity' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default ActivityForm;
