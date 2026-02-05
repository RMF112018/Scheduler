import { Router } from 'express';
import {
  getActivityComments,
  getComment,
  createComment,
  updateComment,
  deleteComment,
  addReaction,
  removeReaction,
  getMentionableUsers,
} from '../controllers/commentController';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Activity comments
router.get('/activities/:activityId/comments', getActivityComments);
router.post('/activities/:activityId/comments', createComment);

// Single comment operations
router.get('/comments/:commentId', getComment);
router.put('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

// Reactions
router.post('/comments/:commentId/reactions', addReaction);
router.delete('/comments/:commentId/reactions/:emoji', removeReaction);

// Mentionable users for autocomplete
router.get('/projects/:projectId/mentionable-users', getMentionableUsers);

export default router;
