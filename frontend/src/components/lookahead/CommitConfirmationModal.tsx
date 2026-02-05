import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Alert,
  AlertTitle,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Collapse,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  PhotoLibrary as GalleryIcon,
  NoteAdd as NoteIcon,
  AttachFile as AttachFileIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  OpenInNew as OpenInNewIcon,
  Celebration as CelebrationIcon,
} from '@mui/icons-material';
import type { Conflict, LookaheadActivity } from '@store/slices/lookaheadSlice';
import type { ValidationIssue } from '@shared/index';
import { CommitSuccessAnimation } from '@components/animations';

// Types for the modal
interface CommitConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (attachments: AttachmentUpload[]) => void;
  lookaheadId: string;
  lookaheadName: string;
  activities: LookaheadActivity[];
  conflicts: Conflict[];
  validationIssues?: ValidationIssue[];
  isLoading?: boolean;
  onOpenIssuesPanel?: () => void;
  /** Show success animation after commit (Phase 8) */
  showSuccessAnimation?: boolean;
  /** Callback when success animation completes */
  onSuccessAnimationComplete?: () => void;
}

interface AttachmentUpload {
  type: 'photo' | 'gallery' | 'note' | 'file';
  file?: File;
  note?: string;
  activityId?: string;
}

// Severity icon mapping
const getSeverityIcon = (severity: 'high' | 'medium' | 'low' | 'error' | 'warning' | 'info') => {
  switch (severity) {
    case 'high':
    case 'error':
      return <ErrorIcon color="error" />;
    case 'medium':
    case 'warning':
      return <WarningIcon color="warning" />;
    case 'low':
    case 'info':
      return <InfoIcon color="info" />;
    default:
      return <InfoIcon color="info" />;
  }
};

// Severity color mapping
const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'high':
    case 'error':
      return 'error';
    case 'medium':
    case 'warning':
      return 'warning';
    case 'low':
    case 'info':
      return 'info';
    default:
      return 'default';
  }
};

const CommitConfirmationModal: React.FC<CommitConfirmationModalProps> = ({
  open,
  onClose,
  onConfirm,
  lookaheadId,
  lookaheadName,
  activities,
  conflicts,
  validationIssues = [],
  isLoading = false,
  onOpenIssuesPanel,
  showSuccessAnimation = false,
  onSuccessAnimationComplete,
}) => {
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('md'));
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [confirmed, setConfirmed] = useState(false);
  const [hasNavigatedAway, setHasNavigatedAway] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([]);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Combine conflicts and validation issues
  const allIssues = [
    ...conflicts.map((c) => ({
      id: c.activityId,
      type: c.type,
      severity: c.severity as 'high' | 'medium' | 'low',
      message: c.message,
      activityName: c.activityName,
    })),
    ...validationIssues.map((v) => ({
      id: v.activityId,
      type: v.ruleType,
      severity: v.severity as 'error' | 'warning' | 'info',
      message: v.message,
      activityName: v.activityName,
    })),
  ];

  const criticalIssues = allIssues.filter(
    (i) => i.severity === 'high' || i.severity === 'error'
  );
  const warningIssues = allIssues.filter(
    (i) => i.severity === 'medium' || i.severity === 'warning'
  );
  const infoIssues = allIssues.filter(
    (i) => i.severity === 'low' || i.severity === 'info'
  );

  const hasNoIssues = allIssues.length === 0;
  const activitiesToCommit = activities.filter(
    (a) => a.plannerStatus === 'will_do' && !a.isCommitted
  );

  // Reset confirmation when modal closes or user navigates away
  useEffect(() => {
    if (!open) {
      setHasNavigatedAway(true);
    } else if (hasNavigatedAway) {
      setConfirmed(false);
      setHasNavigatedAway(false);
    }
  }, [open, hasNavigatedAway]);

  // Reset state when modal opens fresh
  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setAttachments([]);
      setShowNoteInput(false);
      setNoteText('');
    }
  }, [lookaheadId, open]);

  // Handle visibility change (user switches tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && open) {
        setHasNavigatedAway(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [open]);

  // File input refs
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handlers
  const handleConfirmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmed(event.target.checked);
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleNoteClick = () => {
    setShowNoteInput(true);
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'photo' | 'gallery' | 'file'
  ) => {
    const files = event.target.files;
    if (files) {
      const newAttachments: AttachmentUpload[] = Array.from(files).map((file) => ({
        type,
        file,
      }));
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
    event.target.value = '';
  };

  const handleAddNote = () => {
    if (noteText.trim()) {
      setAttachments((prev) => [...prev, { type: 'note', note: noteText.trim() }]);
      setNoteText('');
      setShowNoteInput(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (confirmed) {
      onConfirm(attachments);
    }
  };

  const handleClose = () => {
    setHasNavigatedAway(true);
    onClose();
  };

  // Display top 2-3 critical issues on large screens
  const displayedIssues = isLargeScreen
    ? criticalIssues.slice(0, 3)
    : criticalIssues.slice(0, 2);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: hasNoIssues ? 'success.main' : 'primary.main',
          color: 'white',
          py: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasNoIssues ? (
            <CelebrationIcon />
          ) : (
            <Badge badgeContent={criticalIssues.length} color="error">
              <WarningIcon />
            </Badge>
          )}
          <Typography variant="h6" component="span">
            {hasNoIssues ? 'Ready to Commit!' : 'Commit Confirmation'}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Success Banner when no issues */}
        {hasNoIssues && (
          <Alert
            severity="success"
            icon={<CheckCircleIcon fontSize="large" />}
            sx={{
              borderRadius: 0,
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <AlertTitle sx={{ fontWeight: 600 }}>All Issues Resolved!</AlertTitle>
            <Typography variant="body2">
              No conflicts or validation issues detected. Your lookahead is ready to commit.
            </Typography>
          </Alert>
        )}

        {/* Issues Preview (Large screens) */}
        {!hasNoIssues && isLargeScreen && displayedIssues.length > 0 && (
          <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Critical Issues ({criticalIssues.length})
              </Typography>
              {onOpenIssuesPanel && (
                <Button
                  size="small"
                  endIcon={<OpenInNewIcon />}
                  onClick={onOpenIssuesPanel}
                  sx={{ textTransform: 'none' }}
                >
                  View All Issues
                </Button>
              )}
            </Box>
            <List dense disablePadding>
              {displayedIssues.map((issue, index) => (
                <ListItem
                  key={`${issue.id}-${index}`}
                  sx={{
                    bgcolor: 'white',
                    borderRadius: 1,
                    mb: 0.5,
                    border: '1px solid',
                    borderColor: 'error.light',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {getSeverityIcon(issue.severity)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={500}>
                        {issue.activityName}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {issue.message}
                      </Typography>
                    }
                  />
                  <Chip
                    label={issue.type.replace(/_/g, ' ')}
                    size="small"
                    color={getSeverityColor(issue.severity) as any}
                    variant="outlined"
                  />
                </ListItem>
              ))}
            </List>
            {criticalIssues.length > displayedIssues.length && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                +{criticalIssues.length - displayedIssues.length} more critical issues
              </Typography>
            )}
          </Box>
        )}

        {/* Issues Summary (Collapsible on mobile) */}
        {!hasNoIssues && (
          <Box sx={{ p: 2 }}>
            <Box
              onClick={() => setShowAllIssues(!showAllIssues)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                p: 1,
                borderRadius: 1,
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {criticalIssues.length > 0 && (
                  <Chip
                    icon={<ErrorIcon />}
                    label={`${criticalIssues.length} Critical`}
                    color="error"
                    size="small"
                  />
                )}
                {warningIssues.length > 0 && (
                  <Chip
                    icon={<WarningIcon />}
                    label={`${warningIssues.length} Warnings`}
                    color="warning"
                    size="small"
                  />
                )}
                {infoIssues.length > 0 && (
                  <Chip
                    icon={<InfoIcon />}
                    label={`${infoIssues.length} Info`}
                    color="info"
                    size="small"
                  />
                )}
              </Box>
              {showAllIssues ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>

            <Collapse in={showAllIssues}>
              <List dense sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                {allIssues.map((issue, index) => (
                  <ListItem
                    key={`${issue.id}-${index}`}
                    sx={{
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {getSeverityIcon(issue.severity)}
                    </ListItemIcon>
                    <ListItemText
                      primary={issue.activityName}
                      secondary={issue.message}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>
        )}

        <Divider />

        {/* Commit Summary */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Commit Summary
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Lookahead: <strong>{lookaheadName}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Activities to commit:{' '}
            <strong>{activitiesToCommit.length}</strong> marked as "Will Do"
          </Typography>
        </Box>

        <Divider />

        {/* Attachments Section */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Attachments (Optional)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add photos, notes, or files to support this commit
          </Typography>

          {/* Attachment Buttons */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Tooltip title="Take Photo">
              <Button
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={handleCameraClick}
                size={isMobile ? 'small' : 'medium'}
              >
                Camera
              </Button>
            </Tooltip>
            <Tooltip title="Choose from Gallery">
              <Button
                variant="outlined"
                startIcon={<GalleryIcon />}
                onClick={handleGalleryClick}
                size={isMobile ? 'small' : 'medium'}
              >
                Gallery
              </Button>
            </Tooltip>
            <Tooltip title="Add Note">
              <Button
                variant="outlined"
                startIcon={<NoteIcon />}
                onClick={handleNoteClick}
                size={isMobile ? 'small' : 'medium'}
              >
                Note
              </Button>
            </Tooltip>
            <Tooltip title="Attach File">
              <Button
                variant="outlined"
                startIcon={<AttachFileIcon />}
                onClick={handleFileClick}
                size={isMobile ? 'small' : 'medium'}
              >
                File
              </Button>
            </Tooltip>
          </Box>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => handleFileChange(e, 'photo')}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFileChange(e, 'gallery')}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => handleFileChange(e, 'file')}
          />

          {/* Note Input */}
          <Collapse in={showNoteInput}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter your note..."
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 8,
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  onClick={() => {
                    setShowNoteInput(false);
                    setNoteText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                >
                  Add Note
                </Button>
              </Box>
            </Paper>
          </Collapse>

          {/* Attachment List */}
          {attachments.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1 }}>
              <List dense disablePadding>
                {attachments.map((attachment, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {attachment.type === 'photo' && <CameraIcon color="primary" />}
                      {attachment.type === 'gallery' && <GalleryIcon color="primary" />}
                      {attachment.type === 'note' && <NoteIcon color="primary" />}
                      {attachment.type === 'file' && <AttachFileIcon color="primary" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        attachment.type === 'note'
                          ? attachment.note?.substring(0, 50) +
                            (attachment.note && attachment.note.length > 50 ? '...' : '')
                          : attachment.file?.name
                      }
                      secondary={
                        attachment.type === 'note'
                          ? 'Note'
                          : attachment.file
                          ? `${(attachment.file.size / 1024).toFixed(1)} KB`
                          : ''
                      }
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>

        <Divider />

        {/* Confirmation Checkbox */}
        <Box sx={{ p: 2, bgcolor: confirmed ? 'success.light' : 'grey.50' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={handleConfirmChange}
                color="primary"
                sx={{
                  '&.Mui-checked': {
                    color: 'success.main',
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" fontWeight={500}>
                I have reviewed all constraints/conflicts and confirm this submission
              </Typography>
            }
          />
          {hasNavigatedAway && !confirmed && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
              Please re-confirm after returning to this dialog
            </Typography>
          )}
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          bgcolor: 'grey.50',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        {onOpenIssuesPanel && !hasNoIssues && (
          <Button
            variant="outlined"
            onClick={onOpenIssuesPanel}
            startIcon={<OpenInNewIcon />}
            disabled={isLoading}
          >
            Review Issues
          </Button>
        )}
        <Button
          variant="contained"
          color={hasNoIssues ? 'success' : 'primary'}
          onClick={handleSubmit}
          disabled={!confirmed || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : undefined}
        >
          {isLoading ? 'Committing...' : 'Commit Changes'}
        </Button>
      </DialogActions>

      {/* Success Animation Overlay (Phase 8) */}
      <CommitSuccessAnimation
        show={showSuccessAnimation}
        onComplete={onSuccessAnimationComplete}
        message="Committed Successfully"
        autoDismissDelay={1500}
      />
    </Dialog>
  );
};

export default CommitConfirmationModal;
