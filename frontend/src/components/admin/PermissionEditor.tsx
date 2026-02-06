/**
 * Permission Editor Component
 *
 * Phase 11: Granular permission editor for users with project scoping.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import { userManagementApi, type User, type EffectivePermission } from '@services/api/userManagementApi';
import { projectApi } from '@services/api/projectApi';

interface PermissionEditorProps {
  open: boolean;
  onClose: () => void;
  user: User;
}

const RESOURCES = ['schedule', 'lookahead', 'activity', 'project', 'workflow', 'dashboard', 'import', 'export'];
const ACTIONS = ['read', 'write', 'create', 'delete', 'approve', 'reject'];

const PermissionEditor: React.FC<PermissionEditorProps> = ({ open, onClose, user }) => {
  const [permissions, setPermissions] = useState<EffectivePermission[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const projectsData = await projectApi.getProjects();
      setProjects(projectsData.map((p) => ({ id: p.id, name: p.name })));
    } catch (err: any) {
      // Ignore project loading errors
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await userManagementApi.getPermissions(user.id, selectedProjectId || undefined);
      setPermissions(result.permissions);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [user.id, selectedProjectId]);

  useEffect(() => {
    if (open && user) {
      loadProjects();
      if (selectedProjectId) {
        loadPermissions();
      }
    }
  }, [open, user, selectedProjectId, loadProjects, loadPermissions]);

  const handlePermissionToggle = async (resource: string, action: string, granted: boolean) => {
    if (!selectedProjectId) {
      setError('Please select a project first');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await userManagementApi.updatePermission(user.id, selectedProjectId, `${resource}:${action}`, granted);
      setSuccess('Permission updated successfully');
      loadPermissions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update permission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Permission Editor: {user.firstName} {user.lastName}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              value={selectedProjectId}
              label="Project"
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
              }}
            >
              <MenuItem value="">Select a project</MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {selectedProjectId && (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Resource</TableCell>
                  {ACTIONS.map((action) => (
                    <TableCell key={action} align="center">
                      {action}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={ACTIONS.length + 1} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : (
                  RESOURCES.map((resource) => {
                    const resourcePermissions = permissions.filter((p) => p.resource === resource);
                    return (
                      <TableRow key={resource}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {resource}
                          </Typography>
                        </TableCell>
                        {ACTIONS.map((action) => {
                          const perm = resourcePermissions.find((p) => p.action === action);
                          const granted = perm?.granted || false;
                          const source = perm?.source || 'role';
                          return (
                            <TableCell key={action} align="center">
                              <Switch
                                checked={granted}
                                onChange={(e) => handlePermissionToggle(resource, action, e.target.checked)}
                                disabled={loading || source === 'role'}
                                size="small"
                              />
                              {source === 'role' && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  (from role)
                                </Typography>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!selectedProjectId && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">Please select a project to edit permissions</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PermissionEditor;
