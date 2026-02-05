import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  CircularProgress,
  ClickAwayListener,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { MentionableUser } from '../../services/api/commentApi';

// Simple debounce utility
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const debouncedFn = ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T & { cancel: () => void };
  
  debouncedFn.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
  
  return debouncedFn;
}

interface CommentInputProps {
  onSubmit: (content: string, mentions: string[]) => Promise<void>;
  onFetchMentionableUsers: (search: string) => Promise<MentionableUser[]>;
  placeholder?: string;
  autoFocus?: boolean;
  replyingTo?: string | null;
  onCancelReply?: () => void;
}

export const CommentInput: React.FC<CommentInputProps> = ({
  onSubmit,
  onFetchMentionableUsers,
  placeholder = 'Add a comment...',
  autoFocus = false,
  replyingTo,
  onCancelReply,
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionUsers, setMentionUsers] = useState<MentionableUser[]>([]);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionStartRef = useRef<number | null>(null);

  // Track mentions in the content
  const extractMentionIds = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const ids: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      ids.push(match[2]);
    }
    return ids;
  };

  // Debounced fetch for mention suggestions
  const debouncedFetch = useMemo(
    () =>
      debounce(async (search: string) => {
        setLoadingMentions(true);
        try {
          const users = await onFetchMentionableUsers(search);
          setMentionUsers(users);
        } catch (error) {
          console.error('Failed to fetch mentionable users:', error);
          setMentionUsers([]);
        } finally {
          setLoadingMentions(false);
        }
      }, 300),
    [onFetchMentionableUsers]
  );

  useEffect(() => {
    if (showMentions && mentionSearch) {
      debouncedFetch(mentionSearch);
    }
    return () => {
      debouncedFetch.cancel();
    };
  }, [mentionSearch, showMentions, debouncedFetch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newContent = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    setContent(newContent);
    setCursorPosition(newCursorPos);

    // Check for @ trigger
    const textBeforeCursor = newContent.slice(0, newCursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show mentions if there's no space after @ (still typing the mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        mentionStartRef.current = lastAtIndex;
        setMentionSearch(textAfterAt);
        setShowMentions(true);
        setSelectedMentionIndex(0);
        return;
      }
    }

    setShowMentions(false);
    mentionStartRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < mentionUsers.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : mentionUsers.length - 1
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionUsers[selectedMentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const insertMention = (user: MentionableUser) => {
    if (mentionStartRef.current === null) return;

    const beforeMention = content.slice(0, mentionStartRef.current);
    const afterMention = content.slice(cursorPosition);
    const mentionText = `@[${user.firstName} ${user.lastName}](${user.id}) `;
    const newContent = beforeMention + mentionText + afterMention;

    setContent(newContent);
    setShowMentions(false);
    mentionStartRef.current = null;

    // Focus and set cursor position after the mention
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const mentions = extractMentionIds(content);
      await onSubmit(content.trim(), mentions);
      setContent('');
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMentionClick = (user: MentionableUser) => {
    insertMention(user);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {replyingTo && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'action.hover',
            px: 2,
            py: 0.5,
            borderRadius: '4px 4px 0 0',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Replying to comment
          </Typography>
          {onCancelReply && (
            <Typography
              variant="caption"
              color="primary"
              sx={{ cursor: 'pointer' }}
              onClick={onCancelReply}
            >
              Cancel
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder={placeholder}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          disabled={isSubmitting}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: replyingTo ? '0 0 4px 4px' : 1,
            },
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          sx={{ mb: 0.5 }}
        >
          {isSubmitting ? <CircularProgress size={24} /> : <SendIcon />}
        </IconButton>
      </Box>

      {/* Mention suggestions dropdown */}
      {showMentions && (
        <ClickAwayListener onClickAway={() => setShowMentions(false)}>
          <Paper
            elevation={4}
            sx={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 60,
              maxHeight: 200,
              overflow: 'auto',
              zIndex: 1000,
              mb: 0.5,
            }}
          >
            {loadingMentions ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <CircularProgress size={20} />
              </Box>
            ) : mentionUsers.length > 0 ? (
              <List dense>
                {mentionUsers.map((user, index) => (
                  <ListItem
                    key={user.id}
                    onClick={() => handleMentionClick(user)}
                    selected={index === selectedMentionIndex}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&.Mui-selected': { bgcolor: 'action.selected' },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                        {user.firstName[0]}
                        {user.lastName[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${user.firstName} ${user.lastName}`}
                      secondary={user.email}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No users found
                </Typography>
              </Box>
            )}
          </Paper>
        </ClickAwayListener>
      )}
    </Box>
  );
};

export default CommentInput;
