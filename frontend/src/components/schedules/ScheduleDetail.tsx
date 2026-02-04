import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Grid, CircularProgress } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@store/index';
import { fetchSchedule } from '@store/slices/scheduleSlice';
import { fetchActivities } from '@store/slices/activitySlice';

const ScheduleDetail: React.FC = () => {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const dispatch = useAppDispatch();
  const { currentSchedule, loading: scheduleLoading } = useAppSelector((state) => state.schedule);
  const { activities, loading: activitiesLoading } = useAppSelector((state) => state.activity);

  useEffect(() => {
    if (scheduleId) {
      dispatch(fetchSchedule(scheduleId));
      dispatch(fetchActivities(scheduleId));
    }
  }, [scheduleId, dispatch]);

  if (scheduleLoading || activitiesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!currentSchedule) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Schedule not found</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {currentSchedule.name}
      </Typography>
      {currentSchedule.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {currentSchedule.description}
        </Typography>
      )}

      <Grid container spacing={3}>
        {/* Gantt Chart Placeholder */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Gantt Chart
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
                  Gantt Chart Component (D3.js) - To be implemented in Phase 3
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Activity List */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activities ({activities.length})
              </Typography>
              {activities.length === 0 ? (
                <Typography color="text.secondary">No activities in this schedule</Typography>
              ) : (
                <Box component="ul" sx={{ pl: 2 }}>
                  {activities.slice(0, 10).map((activity) => (
                    <li key={activity.id}>
                      <Typography variant="body2">
                        {activity.name} - {activity.duration} days ({activity.percentComplete}% complete)
                      </Typography>
                    </li>
                  ))}
                  {activities.length > 10 && (
                    <Typography variant="body2" color="text.secondary">
                      ... and {activities.length - 10} more activities
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ScheduleDetail;
