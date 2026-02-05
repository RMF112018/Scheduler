// Theme exports
export { 
  lightTheme, 
  darkTheme, 
  statusColors as themedStatusColors, 
  ganttColors as themedGanttColors, 
  type ThemeMode 
} from './constructionTheme';
export { ThemeProvider, useThemeMode } from './ThemeProvider';

// Legacy exports for backwards compatibility (flat color objects)
export { theme, statusColors, ganttColors } from './legacyTheme';

// Default export is light theme for backwards compatibility
export { default } from './constructionTheme';
