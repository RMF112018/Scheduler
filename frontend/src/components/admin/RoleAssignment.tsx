/**
 * Role Assignment Component
 *
 * Phase 11: Assign/remove roles for users with optional project scoping.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { userManagementApi, type User, type Role, type UserRole } from '@services/api/userManagementApi';
import { projectApi } from '@services/api/projectApi';

interface RoleAssignmentProps {
  open: boolean;
  onClose: () => void;
  user: User;
  roles: Role[];
}

const RoleAssignment: React.FC<RoleAssignmentProps> = ({ open, onClose, user, roles }) => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      loadUserRoles();
      loadProjects();
    }
  }, [open, user]);

  const loadUserRoles = async () => {
    try {
      const userData = await userManagementApi.getUser(user.id);
      setUserRoles(userData.roles || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load user roles');
    }
  };

  const loadProjects = async () => {
    try {
      const projectsData = await projectApi.getProjects();
      setProjects(projectsData.map((p) => ({ id: p.id, name: p.name })));
    } catch (err: any) {
      // Ignore project loading errors
    }
  };

  const handleAssignRole = async () => {
    if (!selectedRoleId) return;
    try {
      setLoading(true);
      setError(null);
      await userManagementApi.assignRole(user.id, selectedRoleId, selectedProjectId);
      setSuccess('Role assigned successfully');
      setSelectedRoleId('');
      setSelectedProjectId(null);
      loadUserRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: string, projectId?: string | null) => {
    try {
      setLoading(true);
      setError(null);
      await userManagementApi.removeRole(user.id, roleId, projectId);
      setSuccess('Role removed successfully');
      loadUserRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Role Assignment: {user.firstName} {user.lastName}
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

        {/* Current Roles */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Current Roles
          </Typography>
          {userRoles.length === 0 ? (
            <Typography color="text.secondary">No roles assigned</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {userRoles.map((role) => (
                <Box
                  key={`${role.id}-${role.projectId || 'global'}`}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Chip label={role.name} size="small" sx={{ mr: 1 }} />
                    {role.projectId ? (
                      <Typography variant="body2" color="text.secondary">
                        Project: {role.projectName || role.projectId}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Company-wide
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveRole(role.id, role.projectId)}
                    disabled={loading}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Assign New Role */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Assign New Role
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select value={selectedRoleId} label="Role" onChange={(e) => setSelectedRoleId(e.target.value)}>
              <MenuItem value="">Select a role</MenuItem>
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name} {role.isSystem && '(System)'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Project (optional - leave blank for company-wide)</InputLabel>
            <Select
              value={selectedProjectId || ''}
              label="Project (optional - leave blank for company-wide)"
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
            >
              <MenuItem value="">Company-wide</MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          onClick={handleAssignRole}
          variant="contained"
          disabled={!selectedRoleId || loading}
        >
          {loading ? <CircularProgress size={20} /> : 'Assign Role'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoleAssignment;
