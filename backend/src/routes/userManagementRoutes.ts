/**
 * User Management Routes
 *
 * Phase 11: Admin-only user management endpoints.
 */

import { Router } from 'express';
import { UserManagementController } from '../controllers/userManagementController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();
const controller = new UserManagementController();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// User management routes
router.get('/users', controller.listUsers.bind(controller));
router.post('/users', controller.createUser.bind(controller));
router.get('/users/:id', controller.getUser.bind(controller));
router.put('/users/:id', controller.updateUser.bind(controller));
router.delete('/users/:id', controller.deleteUser.bind(controller));
router.post('/users/import', controller.importUsers.bind(controller));

// Role assignment routes
router.post('/users/:id/roles', controller.assignRole.bind(controller));
router.delete('/users/:id/roles/:roleId', controller.removeRole.bind(controller));

// Project assignment routes
router.post('/users/:id/projects', controller.assignToProject.bind(controller));

// Permission routes
router.get('/users/:id/permissions', controller.getPermissions.bind(controller));
router.put('/users/:id/permissions', controller.updatePermissions.bind(controller));

// Role routes
router.get('/roles', controller.listRoles.bind(controller));

export default router;
