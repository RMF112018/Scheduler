import React from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  SettingsBrightness as SystemIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useThemeMode, type ThemeMode } from '../../theme';

// ============================================
// Theme Toggle Button (Simple)
// ============================================

interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ size = 'medium' }) => {
  const { isDark, toggleMode } = useThemeMode();

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        onClick={toggleMode}
        size={size}
        sx={{
          transition: 'transform 200ms ease-out',
          '&:hover': {
            transform: 'rotate(30deg)',
          },
        }}
      >
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
};

// ============================================
// Theme Toggle Menu (With System Option)
// ============================================

interface ThemeToggleMenuProps {
  size?: 'small' | 'medium' | 'large';
}

export const ThemeToggleMenu: React.FC<ThemeToggleMenuProps> = ({ size = 'medium' }) => {
  const { mode, setMode, isDark } = useThemeMode();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (newMode: ThemeMode) => {
    setMode(newMode);
    handleClose();
  };

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light', icon: <LightModeIcon /> },
    { mode: 'dark', label: 'Dark', icon: <DarkModeIcon /> },
    { mode: 'system', label: 'System', icon: <SystemIcon /> },
  ];

  return (
    <>
      <Tooltip title="Theme settings">
        <IconButton
          onClick={handleClick}
          size={size}
          aria-controls={open ? 'theme-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{
            transition: 'transform 200ms ease-out',
            '&:hover': {
              transform: 'rotate(30deg)',
            },
          }}
        >
          {isDark ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Tooltip>
      <Menu
        id="theme-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            minWidth: 160,
            mt: 1,
          },
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.mode}
            onClick={() => handleSelect(option.mode)}
            selected={mode === option.mode}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
            {mode === option.mode && (
              <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

// ============================================
// Default Export
// ============================================

export default ThemeToggle;
