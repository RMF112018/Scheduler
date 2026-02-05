import { useEffect, useRef } from 'react';

// ============================================
// Types
// ============================================

export interface ShortcutConfig {
  /** The key combination (e.g., 'ctrl+s', 'shift+enter', 'escape') */
  key: string;
  /** Handler function to execute */
  handler: () => void;
  /** Description for help display */
  description?: string;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Whether shortcut is enabled */
  enabled?: boolean;
  /** Scope - only trigger when this element/area is focused */
  scope?: 'global' | 'focused';
}

export type ShortcutMap = Record<string, () => void>;

// ============================================
// Key Normalization
// ============================================

function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  
  // Normalize key name
  let key = e.key.toLowerCase();
  
  // Handle special keys
  const keyMap: Record<string, string> = {
    ' ': 'space',
    'arrowup': 'up',
    'arrowdown': 'down',
    'arrowleft': 'left',
    'arrowright': 'right',
    'escape': 'esc',
  };
  
  key = keyMap[key] || key;
  
  // Don't add modifier keys as the main key
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
    parts.push(key);
  }
  
  return parts.join('+');
}

// ============================================
// Simple Hook (Map-based)
// ============================================

/**
 * Simple keyboard shortcuts hook using a key-handler map
 * 
 * @example
 * useKeyboardShortcuts({
 *   'ctrl+s': handleSave,
 *   'ctrl+shift+e': handleExport,
 *   'esc': handleClose,
 * });
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  options: { enabled?: boolean; preventDefault?: boolean } = {}
): void {
  const { enabled = true, preventDefault = true } = options;
  
  // Use ref to avoid recreating handler on every render
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow escape to work even in inputs
        if (e.key !== 'Escape') return;
      }

      const key = normalizeKey(e);
      const shortcutHandler = shortcutsRef.current[key];
      
      if (shortcutHandler) {
        if (preventDefault) {
          e.preventDefault();
        }
        shortcutHandler();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, preventDefault]);
}

// ============================================
// Advanced Hook (Config-based)
// ============================================

/**
 * Advanced keyboard shortcuts hook with full configuration
 * 
 * @example
 * useKeyboardShortcutsAdvanced([
 *   { key: 'ctrl+s', handler: handleSave, description: 'Save changes' },
 *   { key: 'ctrl+shift+e', handler: handleExport, description: 'Export' },
 *   { key: 'esc', handler: handleClose, description: 'Close panel' },
 * ]);
 */
export function useKeyboardShortcutsAdvanced(
  shortcuts: ShortcutConfig[],
  options: { enabled?: boolean } = {}
): void {
  const { enabled = true } = options;
  
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const key = normalizeKey(e);

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.key !== key) continue;
        if (shortcut.enabled === false) continue;
        
        // Skip if in input and not escape
        if (isInput && e.key !== 'Escape') continue;
        
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        
        shortcut.handler();
        break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}

// ============================================
// Navigation Shortcuts Hook
// ============================================

interface NavigationOptions {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  enabled?: boolean;
}

/**
 * Hook for list/grid navigation with arrow keys
 * 
 * @example
 * useNavigationShortcuts({
 *   onUp: () => setSelectedIndex(i => Math.max(0, i - 1)),
 *   onDown: () => setSelectedIndex(i => Math.min(items.length - 1, i + 1)),
 *   onEnter: () => handleSelect(selectedIndex),
 *   onEscape: () => setSelectedIndex(-1),
 * });
 */
export function useNavigationShortcuts(options: NavigationOptions): void {
  const { enabled = true, ...handlers } = options;

  const shortcuts: ShortcutMap = {};
  
  if (handlers.onUp) shortcuts['up'] = handlers.onUp;
  if (handlers.onDown) shortcuts['down'] = handlers.onDown;
  if (handlers.onLeft) shortcuts['left'] = handlers.onLeft;
  if (handlers.onRight) shortcuts['right'] = handlers.onRight;
  if (handlers.onEnter) shortcuts['enter'] = handlers.onEnter;
  if (handlers.onEscape) shortcuts['esc'] = handlers.onEscape;
  if (handlers.onHome) shortcuts['home'] = handlers.onHome;
  if (handlers.onEnd) shortcuts['end'] = handlers.onEnd;

  useKeyboardShortcuts(shortcuts, { enabled });
}

// ============================================
// Scheduler-specific Shortcuts Hook
// ============================================

interface SchedulerShortcutsOptions {
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onSearch?: () => void;
  onHelp?: () => void;
  onClosePanel?: () => void;
  onNextActivity?: () => void;
  onPreviousActivity?: () => void;
  onToggleView?: () => void;
  enabled?: boolean;
}

/**
 * Pre-configured shortcuts for scheduler power users
 * 
 * @example
 * useSchedulerShortcuts({
 *   onSave: handleSave,
 *   onExport: handleExport,
 *   onNextActivity: () => selectActivity(currentIndex + 1),
 *   onPreviousActivity: () => selectActivity(currentIndex - 1),
 * });
 */
export function useSchedulerShortcuts(options: SchedulerShortcutsOptions): void {
  const { enabled = true, ...handlers } = options;

  const shortcuts: ShortcutMap = {};
  
  // Standard shortcuts
  if (handlers.onSave) shortcuts['ctrl+s'] = handlers.onSave;
  if (handlers.onExport) shortcuts['ctrl+shift+e'] = handlers.onExport;
  if (handlers.onImport) shortcuts['ctrl+shift+i'] = handlers.onImport;
  if (handlers.onUndo) shortcuts['ctrl+z'] = handlers.onUndo;
  if (handlers.onRedo) shortcuts['ctrl+shift+z'] = handlers.onRedo;
  if (handlers.onDelete) shortcuts['delete'] = handlers.onDelete;
  if (handlers.onDuplicate) shortcuts['ctrl+d'] = handlers.onDuplicate;
  if (handlers.onSearch) shortcuts['ctrl+f'] = handlers.onSearch;
  if (handlers.onHelp) shortcuts['f1'] = handlers.onHelp;
  
  // Panel/view shortcuts
  if (handlers.onClosePanel) shortcuts['esc'] = handlers.onClosePanel;
  if (handlers.onToggleView) shortcuts['ctrl+shift+v'] = handlers.onToggleView;
  
  // Navigation
  if (handlers.onNextActivity) shortcuts['down'] = handlers.onNextActivity;
  if (handlers.onPreviousActivity) shortcuts['up'] = handlers.onPreviousActivity;

  useKeyboardShortcuts(shortcuts, { enabled });
}

// ============================================
// Get Shortcut Display String
// ============================================

/**
 * Convert shortcut key to display string (e.g., 'ctrl+s' -> '⌘S' on Mac)
 */
export function getShortcutDisplay(key: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  
  const parts = key.split('+');
  const displayParts = parts.map(part => {
    switch (part.toLowerCase()) {
      case 'ctrl':
        return isMac ? '⌘' : 'Ctrl';
      case 'shift':
        return isMac ? '⇧' : 'Shift';
      case 'alt':
        return isMac ? '⌥' : 'Alt';
      case 'esc':
        return 'Esc';
      case 'enter':
        return '↵';
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'left':
        return '←';
      case 'right':
        return '→';
      case 'space':
        return 'Space';
      case 'delete':
        return isMac ? '⌫' : 'Del';
      default:
        return part.toUpperCase();
    }
  });

  return isMac ? displayParts.join('') : displayParts.join('+');
}

// ============================================
// Default Export
// ============================================

export default useKeyboardShortcuts;
