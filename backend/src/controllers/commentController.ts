import { Request, Response } from 'express';
import { commentService } from '../services/commentService';

// Get comments for an activity
export const getActivityComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { activityId } = req.params;
    const { limit, offset, order } = req.query;
    
    const result = await commentService.getActivityComments(activityId, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      orderBy: order === 'asc' ? 'asc' : 'desc',
    });
    
    res.json({
      success: true,
      data: result.comments,
      pagination: {
        total: result.total,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
    });
  }
};

// Get a single comment
export const getComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    
    const comment = await commentService.getComment(commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }
    
    res.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error fetching comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comment',
    });
  }
};

// Create a comment
export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { activityId } = req.params;
    const { content, parentId, mentions } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required',
      });
    }
    
    const comment = await commentService.createComment({
      lookaheadActivityId: activityId,
      userId,
      content: content.trim(),
      parentId,
      mentions,
    });
    
    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create comment',
    });
  }
};

// Update a comment
export const updateComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { content, mentions } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required',
      });
    }
    
    const comment = await commentService.updateComment(commentId, userId, {
      content: content.trim(),
      mentions,
    });
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found or you do not have permission to edit it',
      });
    }
    
    res.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update comment',
    });
  }
};

// Delete a comment
export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const deleted = await commentService.deleteComment(commentId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found or you do not have permission to delete it',
      });
    }
    
    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete comment',
    });
  }
};

// Add a reaction to a comment
export const addReaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { emoji } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    // Validate emoji - only allow specific construction-appropriate emojis
    const allowedEmojis = ['👍', '✅', '⚠️', '❓', '🔧'];
    if (!emoji || !allowedEmojis.includes(emoji)) {
      return res.status(400).json({
        success: false,
        error: `Invalid emoji. Allowed: ${allowedEmojis.join(' ')}`,
      });
    }
    
    const reaction = await commentService.addReaction(commentId, userId, emoji);
    
    if (!reaction) {
      return res.status(409).json({
        success: false,
        error: 'You have already reacted with this emoji',
      });
    }
    
    res.status(201).json({
      success: true,
      data: reaction,
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add reaction',
    });
  }
};

// Remove a reaction from a comment
export const removeReaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId, emoji } = req.params;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const removed = await commentService.removeReaction(commentId, userId, emoji);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Reaction not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Reaction removed successfully',
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove reaction',
    });
  }
};

// Get mentionable users for a project
export const getMentionableUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { search } = req.query;
    
    const users = await commentService.getMentionableUsers(
      projectId,
      search as string | undefined
    );
    
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching mentionable users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
};
