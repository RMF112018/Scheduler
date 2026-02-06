import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme, type ThemeMode } from './constructionTheme';

// ============================================
// Theme Context Types
// ============================================

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  isDark: boolean;
}

// ============================================
// Theme Context
// ============================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ============================================
// Local Storage Key
// ============================================

const THEME_STORAGE_KEY = 'scheduler-theme-mode';

// ============================================
// System Theme Detection
// ============================================

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// ============================================
// Theme Provider Component
// ============================================

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  defaultMode = 'system' 
}) => {
  // Initialize mode from localStorage or default
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return defaultMode;
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    return stored || defaultMode;
  });

  // Track system theme for 'system' mode
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Persist mode to localStorage
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  // Toggle between light and dark (skips system)
  const toggleMode = useCallback(() => {
    const currentEffective = mode === 'system' ? systemTheme : mode;
    const newMode = currentEffective === 'light' ? 'dark' : 'light';
    setMode(newMode);
  }, [mode, systemTheme, setMode]);

  // Determine effective theme
  const isDark = mode === 'system' ? systemTheme === 'dark' : mode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  // Update document attribute for CSS selectors
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Context value
  const contextValue = useMemo<ThemeContextValue>(() => ({
    mode,
    setMode,
    toggleMode,
    isDark,
  }), [mode, setMode, toggleMode, isDark]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// ============================================
// Hook to use theme context
// ============================================

// eslint-disable-next-line react-refresh/only-export-components
export const useThemeMode = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

// ============================================
// Default Export
// ============================================

export default ThemeProvider;
