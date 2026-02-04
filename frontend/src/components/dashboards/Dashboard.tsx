import React, { useEffect } from 'react';
import { Box, Grid, Typography, Card, CardContent, CircularProgress } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@store/index';
import { fetchExecutiveDashboard } from '@store/slices/dashboardSlice';

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { executive, loading, error } = useAppSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchExecutiveDashboard());
  }, [dispatch]);

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
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Executive Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* Project Progress */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Project Progress
              </Typography>
              {executive?.projects.length ? (
                executive.projects.map((project) => (
                  <Box key={project.id} sx={{ mb: 2 }}>
                    <Typography variant="body1">{project.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {project.progress}% complete - {project.activitiesCompleted}/{project.activitiesTotal} activities
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">No projects found</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Critical Delays */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Critical Delays
              </Typography>
              {executive?.criticalDelays.length ? (
                executive.criticalDelays.map((delay) => (
                  <Box key={delay.id} sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {delay.activityName}
                    </Typography>
                    <Typography variant="caption" color="error">
                      {delay.delayDays} days delayed
                      {delay.isCriticalPath && ' (Critical Path)'}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">No critical delays</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Summary */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Financial Summary
              </Typography>
              {executive?.financial.length ? (
                executive.financial.map((item) => (
                  <Box key={item.projectId} sx={{ mb: 2 }}>
                    <Typography variant="body1">{item.projectName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Budget: ${item.totalBudget.toLocaleString()} | Spent: ${item.totalSpend.toLocaleString()} | Remaining: ${item.remainingBudget.toLocaleString()}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">No financial data</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
