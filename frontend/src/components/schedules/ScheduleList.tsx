import React from 'react';
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
  ListItemSecondaryAction,
  IconButton,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useAppSelector } from '@store/index';

const ScheduleList: React.FC = () => {
  const navigate = useNavigate();
  const { schedules, loading } = useAppSelector((state) => state.schedule);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Schedules</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/schedules/new')}
        >
          New Schedule
        </Button>
      </Box>

      <Card>
        <CardContent>
          {loading ? (
            <Typography>Loading schedules...</Typography>
          ) : schedules.length === 0 ? (
            <Typography color="text.secondary">
              No schedules found. Create your first schedule to get started.
            </Typography>
          ) : (
            <List>
              {schedules.map((schedule) => (
                <ListItem
                  key={schedule.id}
                  button
                  onClick={() => navigate(`/schedules/${schedule.id}`)}
                  sx={{ borderRadius: 1, mb: 1 }}
                >
                  <ListItemText
                    primary={schedule.name}
                    secondary={schedule.description || 'No description'}
                  />
                  <Chip
                    label={schedule.status}
                    color={getStatusColor(schedule.status)}
                    size="small"
                    sx={{ mr: 2 }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/schedules/${schedule.id}/edit`);
                      }}
                      sx={{ mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement delete confirmation
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ScheduleList;
