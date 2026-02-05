/**
 * User Management View
 *
 * Phase 11: Admin-only user management interface.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Paper,
  Toolbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { userManagementApi, type User, type Role, type CreateUserInput, type UpdateUserInput } from '@services/api/userManagementApi';
import RoleAssignment from './RoleAssignment';
import PermissionEditor from './PermissionEditor';
import BulkImport from './BulkImport';

const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateUserInput>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  // Load users and roles
  useEffect(() => {
    loadData();
  }, [page, limit, searchEmail, searchFirstName, searchLastName, selectedRole]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersResult, rolesResult] = await Promise.all([
        userManagementApi.listUsers({
          email: searchEmail || undefined,
          firstName: searchFirstName || undefined,
          lastName: searchLastName || undefined,
          roleId: selectedRole || undefined,
          page: page + 1,
          limit,
        }),
        userManagementApi.listRoles(),
      ]);
      setUsers(usersResult.users);
      setTotal(usersResult.total);
      setRoles(rolesResult.roles);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setError(null);
      const result = await userManagementApi.createUser(formData);
      setSuccess(`User created successfully${result.temporaryPassword ? `. Temporary password: ${result.temporaryPassword}` : ''}`);
      setCreateDialogOpen(false);
      setFormData({ email: '', password: '', firstName: '', lastName: '' });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      setError(null);
      await userManagementApi.updateUser(selectedUser.id, formData);
      setSuccess('User updated successfully');
      setEditDialogOpen(false);
      setSelectedUser(null);
      setFormData({ email: '', password: '', firstName: '', lastName: '' });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      setError(null);
      await userManagementApi.deleteUser(userId);
      setSuccess('User deleted successfully');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    setEditDialogOpen(true);
  };

  const handleRoleAssignment = (user: User) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const handlePermissionEdit = (user: User) => {
    setSelectedUser(user);
    setPermissionDialogOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">User Management</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<PersonAddIcon />}
            onClick={() => setBulkImportOpen(true)}
            sx={{ mr: 2 }}
          >
            Bulk Import
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            New User
          </Button>
        </Box>
      </Box>

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

      <Card>
        <CardContent>
          {/* Search Filters */}
          <Toolbar sx={{ pl: 0, pr: 0, mb: 2 }}>
            <TextField
              label="Email"
              size="small"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              sx={{ mr: 2, width: 200 }}
            />
            <TextField
              label="First Name"
              size="small"
              value={searchFirstName}
              onChange={(e) => setSearchFirstName(e.target.value)}
              sx={{ mr: 2, width: 200 }}
            />
            <TextField
              label="Last Name"
              size="small"
              value={searchLastName}
              onChange={(e) => setSearchLastName(e.target.value)}
              sx={{ mr: 2, width: 200 }}
            />
            <FormControl size="small" sx={{ mr: 2, minWidth: 200 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={selectedRole}
                label="Role"
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <MenuItem value="">All Roles</MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton onClick={loadData}>
              <SearchIcon />
            </IconButton>
          </Toolbar>

          {/* Users Table */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Roles</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary">No users found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.roles && user.roles.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {user.roles.map((role) => (
                              <Chip
                                key={role.id}
                                label={role.name}
                                size="small"
                                color={role.name === 'administrator' ? 'primary' : 'default'}
                              />
                            ))}
                          </Box>
                        ) : (
                          <Chip label="New User" size="small" color="warning" />
                        )}
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEdit(user)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleRoleAssignment(user)}>
                          <PersonAddIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handlePermissionEdit(user)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteUser(user.id)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={limit}
            onRowsPerPageChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Password (optional - will generate if not provided)"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateUser} variant="contained" disabled={!formData.email || !formData.firstName || !formData.lastName}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="New Password (leave blank to keep current)"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateUser} variant="contained" disabled={!formData.email || !formData.firstName || !formData.lastName}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Assignment Dialog */}
      {selectedUser && (
        <RoleAssignment
          open={roleDialogOpen}
          onClose={() => {
            setRoleDialogOpen(false);
            setSelectedUser(null);
            loadData();
          }}
          user={selectedUser}
          roles={roles}
        />
      )}

      {/* Permission Editor Dialog */}
      {selectedUser && (
        <PermissionEditor
          open={permissionDialogOpen}
          onClose={() => {
            setPermissionDialogOpen(false);
            setSelectedUser(null);
            loadData();
          }}
          user={selectedUser}
        />
      )}

      {/* Bulk Import Dialog */}
      <BulkImport
        open={bulkImportOpen}
        onClose={() => {
          setBulkImportOpen(false);
          loadData();
        }}
      />
    </Box>
  );
};

export default UserManagementView;
