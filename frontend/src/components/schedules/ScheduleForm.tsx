import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@store/index';
import { createSchedule } from '@store/slices/scheduleSlice';
import { projectApi } from '@services/api/projectApi';
import type { Project } from '@shared/index';

interface FormErrors {
  name?: string;
  projectId?: string;
  general?: string;
}

const ScheduleForm: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { error: scheduleError } = useAppSelector((state) => state.schedule);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        setProjectsError(null);
        const fetchedProjects = await projectApi.getProjects();
        setProjects(fetchedProjects);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch projects';
        setProjectsError(message);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

  // Validation
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Schedule name is required';
    } else if (name.trim().length > 255) {
      newErrors.name = 'Schedule name must be 255 characters or less';
    }

    if (!projectId) {
      newErrors.projectId = 'Project selection is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    try {
      const result = await dispatch(
        createSchedule({
          projectId,
          name: name.trim(),
          description: description.trim() || undefined,
        })
      ).unwrap();

      // Navigate to the new schedule detail page
      navigate(`/schedules/${result.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create schedule';
      setErrors({
        general: message,
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    navigate('/schedules');
  };

  // Show loading state while fetching projects
  if (loadingProjects) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error if projects failed to load
  if (projectsError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {projectsError}
        </Alert>
        <Button variant="outlined" onClick={handleCancel} startIcon={<CancelIcon />}>
          Back to Schedules
        </Button>
      </Box>
    );
  }

  // Show error if no projects available
  if (projects.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          No projects available. Please create a project first before creating a schedule.
        </Alert>
        <Button variant="outlined" onClick={handleCancel} startIcon={<CancelIcon />}>
          Back to Schedules
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Create New Schedule
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Create a new schedule for your project. You can add activities and manage the project timeline
        after creation.
      </Typography>

      {errors.general && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errors.general}
        </Alert>
      )}

      {scheduleError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {scheduleError}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControl fullWidth required error={!!errors.projectId}>
            <InputLabel id="project-select-label">Project</InputLabel>
            <Select
              labelId="project-select-label"
              id="project-select"
              value={projectId}
              label="Project"
              onChange={(e) => setProjectId(e.target.value)}
              disabled={saving}
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                  {project.description && ` - ${project.description}`}
                </MenuItem>
              ))}
            </Select>
            {errors.projectId && <FormHelperText>{errors.projectId}</FormHelperText>}
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <TextField
            label="Schedule Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            error={!!errors.name}
            helperText={errors.name || 'Enter a descriptive name for this schedule'}
            placeholder="e.g., Main Construction Schedule"
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={4}
            helperText="Optional description for this schedule"
            placeholder="Add any additional details about this schedule..."
            disabled={saving}
          />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
        <Button
          variant="outlined"
          onClick={handleCancel}
          disabled={saving}
          startIcon={<CancelIcon />}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {saving ? 'Creating...' : 'Create Schedule'}
        </Button>
      </Box>
    </Box>
  );
};

export default ScheduleForm;
