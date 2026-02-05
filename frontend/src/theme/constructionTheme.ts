import { createTheme, alpha } from '@mui/material/styles';

// ============================================
// Construction-focused Color Palette
// Professional colors inspired by construction industry
// ============================================

// Primary: Blueprint blue - professional, trustworthy
const primaryColor = {
  main: '#1B4965',
  light: '#4A7C99',
  dark: '#0D2E3F',
  contrastText: '#FFFFFF',
};

// Secondary: Safety orange - construction accent
const secondaryColor = {
  main: '#FF6B35',
  light: '#FF8A5C',
  dark: '#CC4D1A',
  contrastText: '#FFFFFF',
};

// Status colors
const successColor = {
  main: '#2E7D32',
  light: '#4CAF50',
  dark: '#1B5E20',
};

const warningColor = {
  main: '#ED6C02',
  light: '#FFB74D',
  dark: '#E65100',
};

const errorColor = {
  main: '#D32F2F',
  light: '#EF5350',
  dark: '#C62828',
};

// ============================================
// Shared Theme Options
// ============================================

const sharedTypography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.005em',
  },
  h3: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h4: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h5: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  h6: {
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.6,
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  button: {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.9375rem', // 15px - larger for field use
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.5,
  },
};

const sharedShape = {
  borderRadius: 8,
};

// Touch-friendly button sizes (44px minimum)
const touchFriendlyButtonStyles = {
  root: {
    minHeight: 44,
    borderRadius: 8,
    padding: '10px 20px',
    transition: 'all 200ms ease-out',
  },
  contained: {
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    '&:hover': {
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'scale(0.98)',
    },
  },
  outlined: {
    '&:hover': {
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'scale(0.98)',
    },
  },
};

// ============================================
// Light Theme
// ============================================

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: primaryColor,
    secondary: secondaryColor,
    success: successColor,
    warning: warningColor,
    error: errorColor,
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
    },
    divider: alpha('#1E293B', 0.12),
    action: {
      hover: alpha('#1B4965', 0.04),
      selected: alpha('#1B4965', 0.08),
      focus: alpha('#1B4965', 0.12),
    },
  },
  typography: sharedTypography,
  shape: sharedShape,
  shadows: [
    'none',
    '0px 1px 2px rgba(0, 0, 0, 0.05)',
    '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)',
    '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)',
    '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)',
    '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
  ],
  components: {
    MuiButton: {
      styleOverrides: touchFriendlyButtonStyles,
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)',
          borderRadius: 12,
          transition: 'box-shadow 200ms ease-out, transform 200ms ease-out',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid',
          borderColor: alpha('#1E293B', 0.12),
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#F8FAFC',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          transition: 'all 200ms ease-out',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 200ms ease-out',
          '&:hover': {
            transform: 'scale(1.05)',
          },
          '&:active': {
            transform: 'scale(0.95)',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 6,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.8125rem',
          padding: '8px 12px',
          borderRadius: 6,
        },
      },
    },
  },
});

// ============================================
// Dark Theme
// ============================================

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#64B5F6', // Lighter blue for dark mode
      light: '#90CAF9',
      dark: '#42A5F5',
      contrastText: '#000000',
    },
    secondary: {
      main: '#FFB74D', // Lighter orange for dark mode
      light: '#FFCC80',
      dark: '#FFA726',
      contrastText: '#000000',
    },
    success: {
      main: '#66BB6A',
      light: '#81C784',
      dark: '#4CAF50',
    },
    warning: {
      main: '#FFA726',
      light: '#FFB74D',
      dark: '#FF9800',
    },
    error: {
      main: '#EF5350',
      light: '#E57373',
      dark: '#F44336',
    },
    background: {
      default: '#0F172A',
      paper: '#1E293B',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: alpha('#F1F5F9', 0.12),
    action: {
      hover: alpha('#64B5F6', 0.08),
      selected: alpha('#64B5F6', 0.16),
      focus: alpha('#64B5F6', 0.12),
    },
  },
  typography: sharedTypography,
  shape: sharedShape,
  shadows: [
    'none',
    '0px 1px 2px rgba(0, 0, 0, 0.3)',
    '0px 1px 3px rgba(0, 0, 0, 0.4), 0px 1px 2px rgba(0, 0, 0, 0.3)',
    '0px 4px 6px -1px rgba(0, 0, 0, 0.4), 0px 2px 4px -1px rgba(0, 0, 0, 0.3)',
    '0px 10px 15px -3px rgba(0, 0, 0, 0.4), 0px 4px 6px -2px rgba(0, 0, 0, 0.3)',
    '0px 20px 25px -5px rgba(0, 0, 0, 0.4), 0px 10px 10px -5px rgba(0, 0, 0, 0.3)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
  ],
  components: {
    MuiButton: {
      styleOverrides: touchFriendlyButtonStyles,
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.4), 0px 1px 2px rgba(0, 0, 0, 0.3)',
          borderRadius: 12,
          backgroundColor: '#1E293B',
          border: '1px solid',
          borderColor: alpha('#F1F5F9', 0.08),
          transition: 'box-shadow 200ms ease-out, transform 200ms ease-out',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1E293B',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.4)',
          backgroundColor: '#1E293B',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid',
          borderColor: alpha('#F1F5F9', 0.08),
          backgroundColor: '#1E293B',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#0F172A',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          transition: 'all 200ms ease-out',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 200ms ease-out',
          '&:hover': {
            transform: 'scale(1.05)',
          },
          '&:active': {
            transform: 'scale(0.95)',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 6,
          backgroundColor: alpha('#F1F5F9', 0.12),
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          backgroundColor: '#1E293B',
          border: '1px solid',
          borderColor: alpha('#F1F5F9', 0.08),
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.8125rem',
          padding: '8px 12px',
          borderRadius: 6,
          backgroundColor: '#334155',
        },
      },
    },
  },
});

// ============================================
// Status Colors Export
// ============================================

export const statusColors = {
  light: {
    completed: successColor.main,
    inProgress: primaryColor.main,
    atRisk: warningColor.main,
    delayed: errorColor.main,
    notStarted: '#94A3B8',
    conflict: errorColor.main,
    shouldDo: warningColor.main,
    willDo: successColor.main,
  },
  dark: {
    completed: '#66BB6A',
    inProgress: '#64B5F6',
    atRisk: '#FFA726',
    delayed: '#EF5350',
    notStarted: '#64748B',
    conflict: '#EF5350',
    shouldDo: '#FFA726',
    willDo: '#66BB6A',
  },
};

// ============================================
// Gantt Chart Colors Export
// ============================================

export const ganttColors = {
  light: {
    criticalPath: errorColor.main,
    normalTask: primaryColor.main,
    milestone: '#7C3AED',
    summary: '#475569',
    baseline: alpha(primaryColor.main, 0.3),
    progress: successColor.main,
    today: secondaryColor.main,
  },
  dark: {
    criticalPath: '#EF5350',
    normalTask: '#64B5F6',
    milestone: '#A78BFA',
    summary: '#94A3B8',
    baseline: alpha('#64B5F6', 0.3),
    progress: '#66BB6A',
    today: '#FFB74D',
  },
};

// ============================================
// Theme Mode Type
// ============================================

export type ThemeMode = 'light' | 'dark' | 'system';

// ============================================
// Default Export
// ============================================

export default lightTheme;
