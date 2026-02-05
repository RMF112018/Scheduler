import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Divider,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Comment as CommentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { CommentItem } from './CommentItem';
import { CommentInput } from './CommentInput';
import { commentApi, Comment } from '../../services/api/commentApi';

interface ActivityCommentsProps {
  activityId: string;
  projectId: string;
  currentUserId: string;
  initiallyExpanded?: boolean;
}

export const ActivityComments: React.FC<ActivityCommentsProps> = ({
  activityId,
  projectId,
  currentUserId,
  initiallyExpanded = false,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await commentApi.getActivityComments(activityId, {
        order: 'desc',
      });
      setComments(result.comments);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (expanded) {
      fetchComments();
    }
  }, [expanded, fetchComments]);

  const handleSubmit = async (content: string, mentions: string[]) => {
    try {
      const newComment = await commentApi.createComment(activityId, content, {
        parentId: replyingTo || undefined,
        mentions,
      });

      if (replyingTo) {
        // Add reply to the parent comment
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyingTo
              ? { ...c, replies: [...(c.replies || []), newComment] }
              : c
          )
        );
        setReplyingTo(null);
      } else {
        // Add new top-level comment
        setComments((prev) => [newComment, ...prev]);
        setTotal((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Failed to create comment:', err);
      throw err;
    }
  };

  const handleEdit = async (commentId: string, content: string) => {
    try {
      const updated = await commentApi.updateComment(commentId, content);
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return updated;
          }
          // Check replies
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? updated : r
              ),
            };
          }
          return c;
        })
      );
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await commentApi.deleteComment(commentId);
      setComments((prev) => {
        // Remove top-level comment
        const filtered = prev.filter((c) => c.id !== commentId);
        if (filtered.length !== prev.length) {
          setTotal((t) => t - 1);
          return filtered;
        }
        // Remove from replies
        return prev.map((c) => ({
          ...c,
          replies: c.replies?.filter((r) => r.id !== commentId),
        }));
      });
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleAddReaction = async (commentId: string, emoji: string) => {
    try {
      const reaction = await commentApi.addReaction(commentId, emoji);
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              reactions: [...(c.reactions || []), reaction],
            };
          }
          // Check replies
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId
                  ? { ...r, reactions: [...(r.reactions || []), reaction] }
                  : r
              ),
            };
          }
          return c;
        })
      );
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
  };

  const handleRemoveReaction = async (commentId: string, emoji: string) => {
    try {
      await commentApi.removeReaction(commentId, emoji);
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              reactions: (c.reactions || []).filter(
                (r) => !(r.emoji === emoji && r.userId === currentUserId)
              ),
            };
          }
          // Check replies
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId
                  ? {
                      ...r,
                      reactions: (r.reactions || []).filter(
                        (react) =>
                          !(react.emoji === emoji && react.userId === currentUserId)
                      ),
                    }
                  : r
              ),
            };
          }
          return c;
        })
      );
    } catch (err) {
      console.error('Failed to remove reaction:', err);
    }
  };

  const handleFetchMentionableUsers = async (search: string) => {
    return commentApi.getMentionableUsers(projectId, search);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          py: 1,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <CommentIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Comments {total > 0 && `(${total})`}
        </Typography>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Divider sx={{ mb: 2 }} />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <>
            <CommentInput
              onSubmit={handleSubmit}
              onFetchMentionableUsers={handleFetchMentionableUsers}
              placeholder={
                replyingTo ? 'Write a reply...' : 'Add a comment... Use @ to mention'
              }
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />

            <Box sx={{ mt: 2 }}>
              {comments.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: 2 }}
                >
                  No comments yet. Be the first to comment!
                </Typography>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUserId={currentUserId}
                    onReply={setReplyingTo}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAddReaction={handleAddReaction}
                    onRemoveReaction={handleRemoveReaction}
                  />
                ))
              )}
            </Box>
          </>
        )}
      </Collapse>
    </Box>
  );
};

export default ActivityComments;
