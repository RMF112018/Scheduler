/**
 * Custom Hooks Index
 *
 * Exports all custom React hooks for clean imports
 */

// Offline hooks
export { useOfflineSync, type UseOfflineSyncReturn } from './useOfflineSync';
export { useOfflineLookahead, type UseOfflineLookaheadReturn } from './useOfflineLookahead';

// Socket hook
export { useSocket, default as useSocketDefault } from './useSocket';

// Phase 8: User Engagement hooks
export { 
  useRoleBasedLanding, 
  isFieldRole, 
  isSupervisoryRole, 
  isPlanningRole, 
  isExecutiveRole,
  type UserRole,
} from './useRoleBasedLanding';

export { 
  useKeyboardShortcuts, 
  useKeyboardShortcutsAdvanced,
  useNavigationShortcuts,
  useSchedulerShortcuts,
  getShortcutDisplay,
  type ShortcutConfig,
  type ShortcutMap,
} from './useKeyboardShortcuts';