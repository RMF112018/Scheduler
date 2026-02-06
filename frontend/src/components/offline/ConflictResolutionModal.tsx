/**
 * ConflictResolutionModal Component
 *
 * Modal dialog for resolving sync conflicts between local and server data.
 * Features:
 * - Side-by-side comparison of local vs server values
 * - Three resolution options: Keep Local, Keep Server, Merge
 * - Field-by-field merge capability
 * - Conflict history and details
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Divider,
  IconButton,
  Alert,
  FormControlLabel,
  Radio,
  RadioGroup,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Close as CloseIcon,
  Computer as LocalIcon,
  Cloud as ServerIcon,
  MergeType as MergeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useOfflineSync } from '@hooks/useOfflineSync';

export interface ConflictResolutionModalProps {
  open: boolean;
  onClose: () => void;
  onResolved?: () => void;
}

type Resolution = 'local' | 'server' | 'merge';

interface FieldSelection {
  [key: string]: 'local' | 'server';
}

// Helper function to format time ago
const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  open,
  onClose,
  onResolved,
}) => {
  const {
    conflicts,
    resolveConflictKeepLocal,
    resolveConflictKeepServer,
    resolveConflictMerge,
  } = useOfflineSync();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolution, setResolution] = useState<Resolution>('local');
  const [fieldSelections, setFieldSelections] = useState<FieldSelection>({});
  const [isResolving, setIsResolving] = useState(false);

  const currentConflict = conflicts[currentIndex];

  // Get conflicting fields
  const conflictingFields = useMemo(() => {
    if (!currentConflict) return [];

    const local = currentConflict.localValue;
    const server = currentConflict.serverValue;
    const fields: Array<{
      key: string;
      localValue: unknown;
      serverValue: unknown;
      isDifferent: boolean;
    }> = [];

    const allKeys = new Set([...Object.keys(local), ...Object.keys(server)]);

    allKeys.forEach((key) => {
      const localVal = local[key];
      const serverVal = server[key];
      const isDifferent = JSON.stringify(localVal) !== JSON.stringify(serverVal);

      fields.push({
        key,
        localValue: localVal,
        serverValue: serverVal,
        isDifferent,
      });
    });

    return fields;
  }, [currentConflict]);

  // Initialize field selections when conflict changes
  React.useEffect(() => {
    if (currentConflict) {
      const initial: FieldSelection = {};
      conflictingFields.forEach((field) => {
        initial[field.key] = 'local';
      });
      setFieldSelections(initial);
    }
  }, [currentConflict, conflictingFields]);

  const handleResolutionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setResolution(event.target.value as Resolution);
  };

  const handleFieldSelectionChange = (key: string, value: 'local' | 'server') => {
    setFieldSelections((prev) => ({ ...prev, [key]: value }));
  };

  const handleResolve = async () => {
    if (!currentConflict?.id) return;

    setIsResolving(true);
    try {
      switch (resolution) {
        case 'local':
          await resolveConflictKeepLocal(currentConflict.id);
          break;
        case 'server':
          await resolveConflictKeepServer(currentConflict.id);
          break;
        case 'merge': {
          const mergedValue: Record<string, unknown> = {};
          conflictingFields.forEach((field) => {
            const source = fieldSelections[field.key] || 'local';
            mergedValue[field.key] =
              source === 'local' ? field.localValue : field.serverValue;
          });
          await resolveConflictMerge(currentConflict.id, mergedValue);
          break;
        }
      }

      // Move to next conflict or close
      if (currentIndex < conflicts.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setResolution('local');
      } else {
        onResolved?.();
        onClose();
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setResolution('local');
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getFieldLabel = (key: string): string => {
    const labels: Record<string, string> = {
      plannerStatus: 'Planner Status',
      percentComplete: 'Progress',
      startDate: 'Start Date',
      finishDate: 'Finish Date',
      duration: 'Duration',
      name: 'Name',
    };
    return labels[key] || key.replace(/([A-Z])/g, ' $1').trim();
  };

  if (!currentConflict) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Sync Conflicts</Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            py={4}
          >
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              All Conflicts Resolved
            </Typography>
            <Typography color="text.secondary">
              Your data is now in sync with the server.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            <Typography variant="h6">Resolve Sync Conflict</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <Chip
              label={`${currentIndex + 1} of ${conflicts.length}`}
              size="small"
              color="primary"
            />
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Conflict Info */}
        <Alert severity="warning" sx={{ mb: 3 }}>
          This {currentConflict.entityType} was modified both locally and on the server. Choose
          which version to keep or merge the changes.
        </Alert>

        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Conflict detected{' '}
          {formatTimeAgo(currentConflict.detectedAt)}
        </Typography>

        {/* Resolution Options */}
        <RadioGroup value={resolution} onChange={handleResolutionChange} sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderColor: resolution === 'local' ? 'primary.main' : 'divider',
                  borderWidth: resolution === 'local' ? 2 : 1,
                  bgcolor: resolution === 'local' ? 'primary.light' : 'background.paper',
                }}
                onClick={() => setResolution('local')}
              >
                <FormControlLabel
                  value="local"
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <LocalIcon />
                      <Typography fontWeight="medium">Keep Local</Typography>
                    </Box>
                  }
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Use your offline changes and overwrite server data
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderColor: resolution === 'server' ? 'primary.main' : 'divider',
                  borderWidth: resolution === 'server' ? 2 : 1,
                  bgcolor: resolution === 'server' ? 'primary.light' : 'background.paper',
                }}
                onClick={() => setResolution('server')}
              >
                <FormControlLabel
                  value="server"
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <ServerIcon />
                      <Typography fontWeight="medium">Keep Server</Typography>
                    </Box>
                  }
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Discard local changes and use server data
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderColor: resolution === 'merge' ? 'primary.main' : 'divider',
                  borderWidth: resolution === 'merge' ? 2 : 1,
                  bgcolor: resolution === 'merge' ? 'primary.light' : 'background.paper',
                }}
                onClick={() => setResolution('merge')}
              >
                <FormControlLabel
                  value="merge"
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <MergeIcon />
                      <Typography fontWeight="medium">Merge</Typography>
                    </Box>
                  }
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Choose which value to keep for each field
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </RadioGroup>

        <Divider sx={{ my: 3 }} />

        {/* Field Comparison */}
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          Field Comparison
        </Typography>

        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          {/* Header */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              bgcolor: 'grey.100',
              p: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" fontWeight="medium">
              Field
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <LocalIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight="medium">
                Local Value
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <ServerIcon fontSize="small" color="secondary" />
              <Typography variant="subtitle2" fontWeight="medium">
                Server Value
              </Typography>
            </Box>
          </Box>

          {/* Fields */}
          <List disablePadding>
            {conflictingFields.map((field, index) => (
              <ListItem
                key={field.key}
                divider={index < conflictingFields.length - 1}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  alignItems: 'center',
                  bgcolor: field.isDifferent ? 'warning.light' : 'transparent',
                }}
              >
                <ListItemText
                  primary={getFieldLabel(field.key)}
                  primaryTypographyProps={{ fontWeight: field.isDifferent ? 'medium' : 'regular' }}
                />

                {resolution === 'merge' && field.isDifferent ? (
                  <>
                    <Box
                      onClick={() => handleFieldSelectionChange(field.key, 'local')}
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor:
                          fieldSelections[field.key] === 'local'
                            ? 'primary.light'
                            : 'transparent',
                        border: 1,
                        borderColor:
                          fieldSelections[field.key] === 'local'
                            ? 'primary.main'
                            : 'transparent',
                      }}
                    >
                      <Typography variant="body2">
                        {formatValue(field.localValue)}
                      </Typography>
                    </Box>
                    <Box
                      onClick={() => handleFieldSelectionChange(field.key, 'server')}
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor:
                          fieldSelections[field.key] === 'server'
                            ? 'secondary.light'
                            : 'transparent',
                        border: 1,
                        borderColor:
                          fieldSelections[field.key] === 'server'
                            ? 'secondary.main'
                            : 'transparent',
                      }}
                    >
                      <Typography variant="body2">
                        {formatValue(field.serverValue)}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <>
                    <Typography
                      variant="body2"
                      color={
                        resolution === 'local' && field.isDifferent
                          ? 'primary.main'
                          : 'text.primary'
                      }
                      fontWeight={
                        resolution === 'local' && field.isDifferent ? 'medium' : 'regular'
                      }
                    >
                      {formatValue(field.localValue)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color={
                        resolution === 'server' && field.isDifferent
                          ? 'secondary.main'
                          : 'text.primary'
                      }
                      fontWeight={
                        resolution === 'server' && field.isDifferent ? 'medium' : 'regular'
                      }
                    >
                      {formatValue(field.serverValue)}
                    </Typography>
                  </>
                )}
              </ListItem>
            ))}
          </List>
        </Paper>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isResolving}>
          Cancel
        </Button>
        {conflicts.length > 1 && (
          <Button onClick={handleSkip} disabled={isResolving}>
            Skip
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleResolve}
          disabled={isResolving}
          startIcon={
            resolution === 'local' ? (
              <LocalIcon />
            ) : resolution === 'server' ? (
              <ServerIcon />
            ) : (
              <MergeIcon />
            )
          }
        >
          {isResolving
            ? 'Resolving...'
            : resolution === 'local'
              ? 'Keep Local'
              : resolution === 'server'
                ? 'Keep Server'
                : 'Apply Merge'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConflictResolutionModal;
