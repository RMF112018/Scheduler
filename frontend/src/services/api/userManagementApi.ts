/**
 * User Management API
 *
 * Phase 11: Admin-only user management API client.
 */

import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  roles?: UserRole[];
  permissions?: ProjectPermission[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  assignedAt: string;
}

export interface ProjectPermission {
  permission: string;
  projectId: string;
  projectName: string;
  granted: boolean;
  grantedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  defaultPermissions?: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  roleId?: string;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

export interface UserSearchFilters {
  email?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
  projectId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ImportResult {
  imported: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
}

export interface EffectivePermission {
  resource: string;
  action: string;
  scope: string;
  granted: boolean;
  source: 'role' | 'project_override' | 'user_permission';
}

export const userManagementApi = {
  /**
   * List/search users
   */
  listUsers: async (filters?: UserSearchFilters): Promise<PaginatedUsers> => {
    const params = new URLSearchParams();
    if (filters?.email) params.append('email', filters.email);
    if (filters?.firstName) params.append('firstName', filters.firstName);
    if (filters?.lastName) params.append('lastName', filters.lastName);
    if (filters?.roleId) params.append('roleId', filters.roleId);
    if (filters?.projectId) params.append('projectId', filters.projectId);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get(`/admin/users?${params.toString()}`);
    return response.data;
  },

  /**
   * Get user details
   */
  getUser: async (userId: string): Promise<User> => {
    const response = await apiClient.get(`/admin/users/${userId}`);
    return response.data;
  },

  /**
   * Create user
   */
  createUser: async (data: CreateUserInput): Promise<{ user: User; temporaryPassword?: string }> => {
    const response = await apiClient.post('/admin/users', data);
    return response.data;
  },

  /**
   * Update user
   */
  updateUser: async (userId: string, data: UpdateUserInput): Promise<{ user: User }> => {
    const response = await apiClient.put(`/admin/users/${userId}`, data);
    return response.data;
  },

  /**
   * Delete user
   */
  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${userId}`);
  },

  /**
   * Bulk import users from CSV
   */
  importUsers: async (csvContent: string): Promise<ImportResult> => {
    const response = await apiClient.post('/admin/users/import', { csvContent });
    return response.data;
  },

  /**
   * Assign role to user
   */
  assignRole: async (
    userId: string,
    roleId: string,
    projectId?: string | null
  ): Promise<{ userRole: UserRole }> => {
    const response = await apiClient.post(`/admin/users/${userId}/roles`, {
      roleId,
      projectId,
    });
    return response.data;
  },

  /**
   * Remove role from user
   */
  removeRole: async (userId: string, roleId: string, projectId?: string | null): Promise<void> => {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    await apiClient.delete(`/admin/users/${userId}/roles/${roleId}?${params.toString()}`);
  },

  /**
   * Assign user to project
   */
  assignToProject: async (userId: string, projectId: string, roleId: string): Promise<void> => {
    await apiClient.post(`/admin/users/${userId}/projects`, { projectId, roleId });
  },

  /**
   * Get effective permissions for user
   */
  getPermissions: async (
    userId: string,
    projectId?: string
  ): Promise<{ permissions: EffectivePermission[] }> => {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    const response = await apiClient.get(`/admin/users/${userId}/permissions?${params.toString()}`);
    return response.data;
  },

  /**
   * Update permissions for user
   */
  updatePermission: async (
    userId: string,
    projectId: string,
    permission: string,
    granted: boolean
  ): Promise<{ permission: ProjectPermission }> => {
    const response = await apiClient.put(`/admin/users/${userId}/permissions`, {
      projectId,
      permission,
      granted,
    });
    return response.data;
  },

  /**
   * List all roles
   */
  listRoles: async (): Promise<{ roles: Role[] }> => {
    const response = await apiClient.get('/admin/roles');
    return response.data;
  },
};
