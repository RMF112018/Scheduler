import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Button,
  Drawer,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  List as ListIcon,
  Commit as CommitIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@store/index';
import {
  fetchLookahead,
  setViewMode,
  markTaskStatus,
  checkConflicts,
} from '@store/slices/lookaheadSlice';
import CalendarView from './CalendarView';
import TaskListView from './TaskListView';
import ConflictAlertPanel from './ConflictAlertPanel';
import CommitConfirmationModal from './CommitConfirmationModal';

const LookaheadView: React.FC = () => {
  const { lookaheadId } = useParams<{ lookaheadId: string }>();
  const dispatch = useAppDispatch();
  const { current, loading, error, viewMode } = useAppSelector((state) => state.lookahead);

  // Local state
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [issuesPanelOpen, setIssuesPanelOpen] = useState(false);

  useEffect(() => {
    if (lookaheadId) {
      dispatch(fetchLookahead(lookaheadId));
    }
  }, [lookaheadId, dispatch]);

  // Refresh conflicts when lookahead changes
  useEffect(() => {
    if (current?.id) {
      dispatch(checkConflicts({ lookaheadId: current.id }));
    }
  }, [current?.id, dispatch]);

  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: 'calendar' | 'list' | null
  ) => {
    if (newMode !== null) {
      dispatch(setViewMode(newMode));
    }
  };

  const handleStatusChange = (activityId: string, status: 'should_do' | 'will_do') => {
    if (current?.id) {
      dispatch(markTaskStatus({ lookaheadId: current.id, activityId, status }));
    }
  };

  const handleBulkStatusChange = (activityIds: string[], status: 'should_do' | 'will_do') => {
    if (current?.id) {
      activityIds.forEach((activityId) => {
        dispatch(markTaskStatus({ lookaheadId: current.id, activityId, status }));
      });
    }
  };

  const handleActivityClick = (activityId: string) => {
    // TODO: Navigate to activity detail or open activity modal
    console.log('Activity clicked:', activityId);
  };

  const handleRefreshConflicts = () => {
    if (current?.id) {
      dispatch(checkConflicts({ lookaheadId: current.id }));
    }
  };

  const handleCommit = (attachments: Array<{ type: string; file?: File; note?: string }>) => {
    // TODO: Implement commit with attachments
    console.log('Committing with attachments:', attachments);
    setCommitModalOpen(false);
  };

  const handleOpenIssuesPanel = () => {
    setIssuesPanelOpen(true);
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

  // Count uncommitted "will do" activities
  const uncommittedCount = current.activities.filter(
    (a) => a.plannerStatus === 'will_do' && !a.isCommitted
  ).length;

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4">{current.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date(current.startDate).toLocaleDateString()} -{' '}
            {new Date(current.endDate).toLocaleDateString()} |{' '}
            {current.activities.length} activities
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            aria-label="view mode"
            size="small"
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

          <Button
            variant="contained"
            color="primary"
            startIcon={<CommitIcon />}
            onClick={() => setCommitModalOpen(true)}
            disabled={uncommittedCount === 0 || current.status === 'submitted'}
          >
            Commit ({uncommittedCount})
          </Button>
        </Box>
      </Box>

      {/* Conflict Alert Panel */}
      {current.conflicts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <ConflictAlertPanel
            conflicts={current.conflicts}
            activities={current.activities}
            onActivityClick={handleActivityClick}
            onRefresh={handleRefreshConflicts}
            variant="banner"
            collapsible
            defaultExpanded={current.conflicts.filter((c) => c.severity === 'high').length > 0}
          />
        </Box>
      )}

      {/* Status indicator for submitted lookahead */}
      {current.status === 'submitted' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          This lookahead has been submitted for approval and is currently locked for editing.
        </Alert>
      )}

      {/* View Content */}
      {viewMode === 'calendar' ? (
        <CalendarView
          activities={current.activities}
          startDate={current.startDate}
          endDate={current.endDate}
          onActivityClick={handleActivityClick}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <TaskListView
          activities={current.activities}
          onActivityClick={handleActivityClick}
          onStatusChange={handleStatusChange}
          onBulkStatusChange={handleBulkStatusChange}
        />
      )}

      {/* Commit Confirmation Modal */}
      <CommitConfirmationModal
        open={commitModalOpen}
        onClose={() => setCommitModalOpen(false)}
        onConfirm={handleCommit}
        lookaheadId={current.id}
        lookaheadName={current.name}
        activities={current.activities}
        conflicts={current.conflicts}
        onOpenIssuesPanel={handleOpenIssuesPanel}
      />

      {/* Issues Panel Drawer */}
      <Drawer
        anchor="right"
        open={issuesPanelOpen}
        onClose={() => setIssuesPanelOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 480 } },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Schedule Issues
          </Typography>
          <ConflictAlertPanel
            conflicts={current.conflicts}
            activities={current.activities}
            onActivityClick={(activityId) => {
              handleActivityClick(activityId);
              setIssuesPanelOpen(false);
            }}
            onRefresh={handleRefreshConflicts}
            variant="panel"
            collapsible={false}
          />
        </Box>
      </Drawer>
    </Box>
  );
};

export default LookaheadView;
