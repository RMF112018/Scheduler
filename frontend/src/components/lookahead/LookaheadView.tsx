import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
} from '@mui/material';
import { CalendarMonth as CalendarIcon, List as ListIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@store/index';
import { fetchLookahead, setViewMode } from '@store/slices/lookaheadSlice';

const LookaheadView: React.FC = () => {
  const { lookaheadId } = useParams<{ lookaheadId: string }>();
  const dispatch = useAppDispatch();
  const { current, loading, error, viewMode } = useAppSelector((state) => state.lookahead);

  useEffect(() => {
    if (lookaheadId) {
      dispatch(fetchLookahead(lookaheadId));
    }
  }, [lookaheadId, dispatch]);

  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: 'calendar' | 'list' | null
  ) => {
    if (newMode !== null) {
      dispatch(setViewMode(newMode));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!current) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Lookahead schedule not found</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{current.name}</Typography>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          aria-label="view mode"
        >
          <ToggleButton value="calendar" aria-label="calendar view">
            <CalendarIcon sx={{ mr: 1 }} />
            Calendar
          </ToggleButton>
          <ToggleButton value="list" aria-label="list view">
            <ListIcon sx={{ mr: 1 }} />
            List
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Conflict Alerts */}
      {current.conflicts.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {current.conflicts.length} conflict(s) detected. Review before committing.
        </Alert>
      )}

      {/* View Content */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {viewMode === 'calendar' ? 'Calendar View' : 'List View'}
          </Typography>
          <Box
            sx={{
              height: 400,
              bgcolor: 'grey.100',
              borderRadius: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Typography color="text.secondary">
              {viewMode === 'calendar'
                ? 'Calendar View Component - To be implemented in Phase 4'
                : 'Task List View Component - To be implemented in Phase 4'}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Activities Summary */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Activities ({current.activities.length})
          </Typography>
          {current.activities.length === 0 ? (
            <Typography color="text.secondary">No activities in this lookahead</Typography>
          ) : (
            <Box>
              {current.activities.slice(0, 5).map((activity) => (
                <Box
                  key={activity.id}
                  sx={{
                    p: 2,
                    mb: 1,
                    bgcolor: activity.hasConflict ? 'error.light' : 'grey.50',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body1" fontWeight={500}>
                    {activity.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Status: {activity.plannerStatus || 'Not set'} |
                    Duration: {activity.duration} days |
                    {activity.percentComplete}% complete
                  </Typography>
                  {activity.hasConflict && (
                    <Typography variant="caption" color="error">
                      ⚠️ Conflict detected
                    </Typography>
                  )}
                </Box>
              ))}
              {current.activities.length > 5 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  ... and {current.activities.length - 5} more activities
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default LookaheadView;
