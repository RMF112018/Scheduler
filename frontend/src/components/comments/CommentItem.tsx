import React, { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Chip,
  TextField,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Reply as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { Comment, CommentReaction } from '../../services/api/commentApi';

// Allowed emojis for construction context
const ALLOWED_EMOJIS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '✅', label: 'Done' },
  { emoji: '⚠️', label: 'Warning' },
  { emoji: '❓', label: 'Question' },
  { emoji: '🔧', label: 'Fix needed' },
];

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onReply?: (parentId: string) => void;
  onEdit?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
  onAddReaction?: (commentId: string, emoji: string) => void;
  onRemoveReaction?: (commentId: string, emoji: string) => void;
  isReply?: boolean;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onAddReaction,
  onRemoveReaction,
  isReply = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showReplies, setShowReplies] = useState(true);

  const isOwner = comment.userId === currentUserId;
  const userName = comment.user
    ? `${comment.user.firstName} ${comment.user.lastName}`
    : 'Unknown User';
  const initials = comment.user
    ? `${comment.user.firstName[0]}${comment.user.lastName[0]}`
    : '?';

  // Group reactions by emoji
  const reactionGroups = (comment.reactions || []).reduce(
    (acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction);
      return acc;
    },
    {} as Record<string, CommentReaction[]>
  );

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onEdit) {
      onEdit(comment.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    handleMenuClose();
    if (onDelete) {
      onDelete(comment.id);
    }
  };

  const handleReactionClick = (emoji: string) => {
    const existingReaction = reactionGroups[emoji]?.find(
      (r) => r.userId === currentUserId
    );
    if (existingReaction) {
      onRemoveReaction?.(comment.id, emoji);
    } else {
      onAddReaction?.(comment.id, emoji);
    }
  };

  // Parse content for @mentions
  const renderContent = (content: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      // Add mention chip
      parts.push(
        <Chip
          key={match[2]}
          label={`@${match[1]}`}
          size="small"
          sx={{
            mx: 0.5,
            height: 20,
            fontSize: '0.75rem',
            bgcolor: 'primary.light',
            color: 'primary.contrastText',
          }}
        />
      );
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        py: 1.5,
        pl: isReply ? 4 : 0,
        borderLeft: isReply ? '2px solid' : 'none',
        borderColor: 'divider',
      }}
    >
      <Avatar
        sx={{
          width: isReply ? 28 : 36,
          height: isReply ? 28 : 36,
          fontSize: isReply ? '0.75rem' : '0.875rem',
          bgcolor: 'primary.main',
        }}
      >
        {initials}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {userName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </Typography>
          {comment.createdAt !== comment.updatedAt && (
            <Typography variant="caption" color="text.secondary">
              (edited)
            </Typography>
          )}
        </Box>

        {isEditing ? (
          <Box sx={{ mt: 1 }}>
            <TextField
              fullWidth
              multiline
              size="small"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button size="small" variant="contained" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button size="small" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {renderContent(comment.content)}
          </Typography>
        )}

        {/* Reactions */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {ALLOWED_EMOJIS.map(({ emoji, label }) => {
            const reactions = reactionGroups[emoji] || [];
            const hasReacted = reactions.some((r) => r.userId === currentUserId);
            const count = reactions.length;

            return (
              <Tooltip
                key={emoji}
                title={
                  count > 0
                    ? reactions
                        .map((r) =>
                          r.user
                            ? `${r.user.firstName} ${r.user.lastName}`
                            : 'Unknown'
                        )
                        .join(', ')
                    : label
                }
              >
                <Chip
                  label={count > 0 ? `${emoji} ${count}` : emoji}
                  size="small"
                  onClick={() => handleReactionClick(emoji)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: hasReacted ? 'primary.light' : 'action.hover',
                    border: hasReacted ? '1px solid' : 'none',
                    borderColor: 'primary.main',
                    '&:hover': {
                      bgcolor: hasReacted ? 'primary.light' : 'action.selected',
                    },
                  }}
                />
              </Tooltip>
            );
          })}

          {!isReply && onReply && (
            <IconButton
              size="small"
              onClick={() => onReply(comment.id)}
              sx={{ ml: 1 }}
            >
              <ReplyIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <>
            <Button
              size="small"
              onClick={() => setShowReplies(!showReplies)}
              sx={{ mt: 1, textTransform: 'none' }}
            >
              {showReplies
                ? `Hide ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`
                : `Show ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`}
            </Button>
            <Collapse in={showReplies}>
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddReaction={onAddReaction}
                  onRemoveReaction={onRemoveReaction}
                  isReply
                />
              ))}
            </Collapse>
          </>
        )}
      </Box>

      {isOwner && (
        <>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleEdit}>
              <EditIcon fontSize="small" sx={{ mr: 1 }} />
              Edit
            </MenuItem>
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
              Delete
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
};

export default CommentItem;
