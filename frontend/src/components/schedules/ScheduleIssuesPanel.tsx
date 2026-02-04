import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Badge,
  Tooltip,
  Alert,
  AlertTitle,
  useTheme,
  useMediaQuery,
  Drawer,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  PlayArrow as ResolveIcon,
  Visibility as ViewIcon,
  Link as LinkIcon,
  Schedule as ScheduleIcon,
  AccountTree as LogicIcon,
  TrendingDown as FloatIcon,
  Timer as DurationIcon,
} from '@mui/icons-material';
import type {
  ValidationIssue,
  ValidationRuleType,
  ValidationRuleSeverity,
  OutOfSequenceViolation,
  ValidationResult,
} from '@shared/index';

// Props interface
interface ScheduleIssuesPanelProps {
  validationResult: ValidationResult | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  onActivityClick?: (activityId: string) => void;
  onResolveOutOfSequence?: (activityId: string) => void;
  variant?: 'panel' | 'drawer';
  open?: boolean;
  onClose?: () => void;
}

// Tab panel props
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Rule type display config
const ruleTypeConfig: Record<
  ValidationRuleType,
  { label: string; icon: React.ReactNode; description: string }
> = {
  missing_logic: {
    label: 'Missing Logic',
    icon: <LogicIcon />,
    description: 'Activities without predecessors or successors',
  },
  negative_float: {
    label: 'Negative Float',
    icon: <FloatIcon />,
    description: 'Activities with negative total float',
  },
  high_duration: {
    label: 'High Duration',
    icon: <DurationIcon />,
    description: 'Activities exceeding duration threshold',
  },
  high_float: {
    label: 'High Float',
    icon: <FloatIcon />,
    description: 'Activities with excessive float',
  },
  invalid_constraint: {
    label: 'Invalid Constraint',
    icon: <ScheduleIcon />,
    description: 'Activities with problematic constraints',
  },
  dangling_activity: {
    label: 'Dangling Activity',
    icon: <LinkIcon />,
    description: 'Activities referencing non-existent relationships',
  },
  out_of_sequence: {
    label: 'Out of Sequence',
    icon: <WarningIcon />,
    description: 'Activities started before predecessors completed',
  },
  circular_dependency: {
    label: 'Circular Dependency',
    icon: <LogicIcon />,
    description: 'Circular relationships detected',
  },
};

// Severity config
const severityConfig: Record<
  ValidationRuleSeverity,
  { color: 'error' | 'warning' | 'info'; icon: React.ReactNode }
> = {
  error: { color: 'error', icon: <ErrorIcon color="error" /> },
  warning: { color: 'warning', icon: <WarningIcon color="warning" /> },
  info: { color: 'info', icon: <InfoIcon color="info" /> },
};

// Tab Panel component
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`issues-tabpanel-${index}`}
      aria-labelledby={`issues-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const ScheduleIssuesPanel: React.FC<ScheduleIssuesPanelProps> = ({
  validationResult,
  isLoading = false,
  onRefresh,
  onActivityClick,
  onResolveOutOfSequence,
  variant = 'panel',
  open = true,
  onClose,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<ValidationRuleSeverity | 'all'>('all');
  const [ruleTypeFilter, setRuleTypeFilter] = useState<ValidationRuleType | 'all'>('all');
  const [tabValue, setTabValue] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['error', 'warning']);

  // Memoized filtered issues
  const filteredIssues = useMemo(() => {
    if (!validationResult) return [];

    return validationResult.issues.filter((issue) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (
          !issue.activityName.toLowerCase().includes(searchLower) &&
          !issue.message.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Severity filter
      if (severityFilter !== 'all' && issue.severity !== severityFilter) {
        return false;
      }

      // Rule type filter
      if (ruleTypeFilter !== 'all' && issue.ruleType !== ruleTypeFilter) {
        return false;
      }

      return true;
    });
  }, [validationResult, searchTerm, severityFilter, ruleTypeFilter]);

  // Group issues by severity
  const groupedBySeverity = useMemo(() => {
    const groups: Record<ValidationRuleSeverity, ValidationIssue[]> = {
      error: [],
      warning: [],
      info: [],
    };

    filteredIssues.forEach((issue) => {
      groups[issue.severity].push(issue);
    });

    return groups;
  }, [filteredIssues]);

  // Group issues by rule type
  const groupedByRuleType = useMemo(() => {
    const groups: Partial<Record<ValidationRuleType, ValidationIssue[]>> = {};

    filteredIssues.forEach((issue) => {
      if (!groups[issue.ruleType]) {
        groups[issue.ruleType] = [];
      }
      groups[issue.ruleType]!.push(issue);
    });

    return groups;
  }, [filteredIssues]);

  // Get unique rule types for filter
  const availableRuleTypes = useMemo(() => {
    if (!validationResult) return [];
    return [...new Set(validationResult.issues.map((i) => i.ruleType))];
  }, [validationResult]);

  // Handle accordion expand
  const handleAccordionChange = (group: string) => {
    setExpandedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Render issue item
  const renderIssueItem = (issue: ValidationIssue, index: number) => {
    const config = ruleTypeConfig[issue.ruleType];
    const severityConf = severityConfig[issue.severity];

    return (
      <ListItem
        key={`${issue.activityId}-${issue.ruleType}-${index}`}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 1,
          mb: 1,
          border: '1px solid',
          borderColor: `${severityConf.color}.light`,
          '&:hover': {
            bgcolor: 'grey.50',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>{severityConf.icon}</ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" fontWeight={600}>
                {issue.activityName}
              </Typography>
              <Chip
                label={config.label}
                size="small"
                variant="outlined"
                icon={config.icon as React.ReactElement}
                sx={{ height: 24 }}
              />
            </Box>
          }
          secondary={
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {issue.message}
            </Typography>
          }
        />
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {onActivityClick && (
              <Tooltip title="View Activity">
                <IconButton
                  size="small"
                  onClick={() => onActivityClick(issue.activityId)}
                >
                  <ViewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {issue.ruleType === 'out_of_sequence' && onResolveOutOfSequence && (
              <Tooltip title="Resolve">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => onResolveOutOfSequence(issue.activityId)}
                >
                  <ResolveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  // Render out-of-sequence violation
  const renderOOSViolation = (violation: OutOfSequenceViolation, index: number) => (
    <ListItem
      key={`oos-${violation.activityId}-${index}`}
      sx={{
        bgcolor: 'error.light',
        borderRadius: 1,
        mb: 1,
        border: '1px solid',
        borderColor: 'error.main',
      }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        <ErrorIcon color="error" />
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography variant="body2" fontWeight={600}>
            {violation.activityName}
          </Typography>
        }
        secondary={
          <Box>
            <Typography variant="caption" color="text.secondary">
              {violation.message}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Chip
                label={`Predecessor: ${violation.predecessorName}`}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
              <Chip
                label={violation.violationType.replace(/_/g, ' ')}
                size="small"
                color="error"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
          </Box>
        }
      />
      <ListItemSecondaryAction>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {onActivityClick && (
            <Tooltip title="View Activity">
              <IconButton
                size="small"
                onClick={() => onActivityClick(violation.activityId)}
              >
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onResolveOutOfSequence && (
            <Tooltip title="Resolve">
              <IconButton
                size="small"
                color="primary"
                onClick={() => onResolveOutOfSequence(violation.activityId)}
              >
                <ResolveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </ListItemSecondaryAction>
    </ListItem>
  );

  // Main content
  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>
            Schedule Issues
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onRefresh && (
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={onRefresh} disabled={isLoading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
            {variant === 'drawer' && onClose && (
              <IconButton size="small" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Summary badges */}
        {validationResult && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            <Chip
              icon={<ErrorIcon />}
              label={`${validationResult.errorCount} Errors`}
              color="error"
              size="small"
              variant={validationResult.errorCount > 0 ? 'filled' : 'outlined'}
            />
            <Chip
              icon={<WarningIcon />}
              label={`${validationResult.warningCount} Warnings`}
              color="warning"
              size="small"
              variant={validationResult.warningCount > 0 ? 'filled' : 'outlined'}
            />
            <Chip
              icon={<InfoIcon />}
              label={`${validationResult.infoCount} Info`}
              color="info"
              size="small"
              variant={validationResult.infoCount > 0 ? 'filled' : 'outlined'}
            />
          </Box>
        )}
      </Box>

      {/* Filters */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search issues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 150 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Severity</InputLabel>
            <Select
              value={severityFilter}
              label="Severity"
              onChange={(e) => setSeverityFilter(e.target.value as ValidationRuleSeverity | 'all')}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="error">Errors</MenuItem>
              <MenuItem value="warning">Warnings</MenuItem>
              <MenuItem value="info">Info</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Rule Type</InputLabel>
            <Select
              value={ruleTypeFilter}
              label="Rule Type"
              onChange={(e) => setRuleTypeFilter(e.target.value as ValidationRuleType | 'all')}
            >
              <MenuItem value="all">All Types</MenuItem>
              {availableRuleTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {ruleTypeConfig[type].label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* No issues state */}
      {validationResult && validationResult.totalIssues === 0 && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Issues Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your schedule passes all validation checks.
          </Typography>
        </Box>
      )}

      {/* No results after filtering */}
      {validationResult &&
        validationResult.totalIssues > 0 &&
        filteredIssues.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <FilterIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" gutterBottom>
              No matching issues
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your filters
            </Typography>
          </Box>
        )}

      {/* Tabs for different views */}
      {validationResult && filteredIssues.length > 0 && (
        <>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="By Severity" />
            <Tab label="By Type" />
            {validationResult.outOfSequenceViolations.length > 0 && (
              <Tab
                label={
                  <Badge
                    badgeContent={validationResult.outOfSequenceViolations.length}
                    color="error"
                  >
                    Out of Sequence
                  </Badge>
                }
              />
            )}
          </Tabs>

          {/* By Severity Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ px: 2, overflow: 'auto', flex: 1 }}>
              {(['error', 'warning', 'info'] as ValidationRuleSeverity[]).map((severity) => {
                const issues = groupedBySeverity[severity];
                if (issues.length === 0) return null;

                const config = severityConfig[severity];

                return (
                  <Accordion
                    key={severity}
                    expanded={expandedGroups.includes(severity)}
                    onChange={() => handleAccordionChange(severity)}
                    sx={{ mb: 1 }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {config.icon}
                        <Typography fontWeight={500}>
                          {severity.charAt(0).toUpperCase() + severity.slice(1)}s
                        </Typography>
                        <Chip label={issues.length} size="small" color={config.color} />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 1 }}>
                      <List dense disablePadding>
                        {issues.map((issue, index) => renderIssueItem(issue, index))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          </TabPanel>

          {/* By Type Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ px: 2, overflow: 'auto', flex: 1 }}>
              {Object.entries(groupedByRuleType).map(([ruleType, issues]) => {
                if (!issues || issues.length === 0) return null;

                const config = ruleTypeConfig[ruleType as ValidationRuleType];

                return (
                  <Accordion
                    key={ruleType}
                    expanded={expandedGroups.includes(ruleType)}
                    onChange={() => handleAccordionChange(ruleType)}
                    sx={{ mb: 1 }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {config.icon}
                        <Typography fontWeight={500}>{config.label}</Typography>
                        <Chip label={issues.length} size="small" />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        {config.description}
                      </Typography>
                      <List dense disablePadding>
                        {issues.map((issue, index) => renderIssueItem(issue, index))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          </TabPanel>

          {/* Out of Sequence Tab */}
          {validationResult.outOfSequenceViolations.length > 0 && (
            <TabPanel value={tabValue} index={2}>
              <Box sx={{ px: 2, overflow: 'auto', flex: 1 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                  <AlertTitle>Out-of-Sequence Activities Detected</AlertTitle>
                  These activities have started or completed before their predecessors.
                  Each must be resolved with a mandatory explanation.
                </Alert>
                <List dense disablePadding>
                  {validationResult.outOfSequenceViolations.map((violation, index) =>
                    renderOOSViolation(violation, index)
                  )}
                </List>
              </Box>
            </TabPanel>
          )}
        </>
      )}

      {/* Loading state */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(255,255,255,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <Typography>Loading validation results...</Typography>
        </Box>
      )}
    </Box>
  );

  // Render as drawer or panel
  if (variant === 'drawer') {
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : 480,
            maxWidth: '100%',
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Paper
      elevation={2}
      sx={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {content}
    </Paper>
  );
};

export default ScheduleIssuesPanel;
