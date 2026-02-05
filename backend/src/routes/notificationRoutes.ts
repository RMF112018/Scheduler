import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const notificationController = new NotificationController();

// Routes - all require authentication
router.use(authenticate);

// Get notifications (with pagination and filtering)
router.get('/', notificationController.getNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Get notification statistics
router.get('/stats', notificationController.getStats);

// Get notification preferences
router.get('/preferences', notificationController.getPreferences);

// Update notification preferences
router.put('/preferences', notificationController.updatePreferences);

// Mark single notification as read
router.put('/:notificationId/read', notificationController.markAsRead);

// Mark multiple notifications as read
router.put('/read-many', notificationController.markManyAsRead);

// Mark all notifications as read
router.put('/read-all', notificationController.markAllAsRead);

// Delete single notification
router.delete('/:notificationId', notificationController.deleteNotification);

// Delete multiple notifications
router.delete('/delete-many', notificationController.deleteManyNotifications);

// Delete all read notifications
router.delete('/delete-read', notificationController.deleteAllRead);

// Send test notification (admin only)
router.post('/test', authorize(['admin']), notificationController.sendTestNotification);

export default router;
