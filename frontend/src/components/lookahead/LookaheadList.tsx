import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@store/index';
import { fetchExecutiveDashboard } from '@store/slices/dashboardSlice';
import { lookaheadApi } from '@services/api/lookaheadApi';
import type { LookaheadSchedule } from '@store/slices/lookaheadSlice';

interface ProjectLookaheads {
  projectId: string;
  projectName: string;
  lookaheads: LookaheadSchedule[];
  loading: boolean;
}

const LookaheadList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { executive, loading: dashboardLoading } = useAppSelector((state) => state.dashboard);
  const [projectLookaheads, setProjectLookaheads] = useState<ProjectLookaheads[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard to get projects
  useEffect(() => {
    if (!executive) {
      dispatch(fetchExecutiveDashboard());
    }
  }, [dispatch, executive]);

  // Fetch lookaheads for each project
  useEffect(() => {
    const fetchAllLookaheads = async () => {
      if (!executive?.projects || executive.projects.length === 0) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const lookaheadPromises = executive.projects.map(async (project) => {
          try {
            // Use the lookahead API to get lookaheads for this project
            const lookaheads = await lookaheadApi.getLookaheads(project.projectId);
            return {
              projectId: project.projectId,
              projectName: project.projectName,
              lookaheads,
              loading: false,
            };
          } catch (err) {
            console.error(`Failed to fetch lookaheads for project ${project.projectId}:`, err);
            return {
              projectId: project.projectId,
              projectName: project.projectName,
              lookaheads: [],
              loading: false,
            };
          }
        });

        const results = await Promise.all(lookaheadPromises);
        setProjectLookaheads(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch lookaheads');
      } finally {
        setLoading(false);
      }
    };

    if (executive?.projects) {
      fetchAllLookaheads();
    }
  }, [executive]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'submitted':
        return 'warning';
      case 'approved':
        return 'info';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (dashboardLoading || loading) {
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

  const totalLookaheads = projectLookaheads.reduce(
    (sum, p) => sum + p.lookaheads.length,
    0
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Lookahead Schedules</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            // TODO: Navigate to create lookahead page
            alert('Create lookahead functionality coming soon');
          }}
        >
          New Lookahead
        </Button>
      </Box>

      {!executive?.projects || executive.projects.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No projects found. Create a project first to create lookahead schedules.
            </Typography>
          </CardContent>
        </Card>
      ) : totalLookaheads === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No lookahead schedules found. Create your first lookahead schedule to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box>
          {projectLookaheads.map((project) => {
            if (project.lookaheads.length === 0) {
              return null;
            }

            return (
              <Accordion key={project.projectId} defaultExpanded sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mr: 2 }}>
                    <CalendarIcon sx={{ mr: 2, color: 'text.secondary' }} />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {project.projectName}
                    </Typography>
                    <Chip
                      label={`${project.lookaheads.length} lookahead${project.lookaheads.length !== 1 ? 's' : ''}`}
                      size="small"
                      sx={{ mr: 2 }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {project.lookaheads.map((lookahead, index) => (
                      <React.Fragment key={lookahead.id}>
                        <ListItem
                          button
                          onClick={() => navigate(`/lookahead/${lookahead.id}`)}
                          sx={{ borderRadius: 1, mb: 1 }}
                        >
                          <ListItemText
                            primary={lookahead.name}
                            secondary={
                              <>
                                {formatDate(lookahead.startDate)} - {formatDate(lookahead.endDate)}
                                {lookahead.lastSyncedAt && (
                                  <> • Last synced: {formatDate(lookahead.lastSyncedAt)}</>
                                )}
                              </>
                            }
                          />
                          <Chip
                            label={lookahead.status}
                            color={getStatusColor(lookahead.status) as any}
                            size="small"
                            sx={{ mr: 2 }}
                          />
                        </ListItem>
                        {index < project.lookaheads.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default LookaheadList;
