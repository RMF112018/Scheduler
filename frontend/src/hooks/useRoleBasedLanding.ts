import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';

// ============================================
// Role Types
// ============================================

export type UserRole = 
  | 'admin'
  | 'executive'
  | 'project_manager'
  | 'superintendent'
  | 'scheduler'
  | 'field_crew'
  | 'subcontractor'
  | 'viewer'
  | 'new_user';

// ============================================
// Route Configuration by Role
// ============================================

interface RoleRouteConfig {
  defaultRoute: string;
  label: string;
  description: string;
}

const roleRouteMap: Record<UserRole, RoleRouteConfig> = {
  // New users - pending assignment
  new_user: {
    defaultRoute: '/pending-assignment',
    label: 'Pending Assignment',
    description: 'Waiting for administrator to assign you to a project',
  },

  // Field users - mobile-first lookahead
  field_crew: {
    defaultRoute: '/lookahead/today',
    label: "Today's Tasks",
    description: 'View and update your assigned tasks for today',
  },
  subcontractor: {
    defaultRoute: '/lookahead/today',
    label: "Today's Tasks",
    description: 'View and commit to scheduled activities',
  },

  // Supervisory - approval queue
  superintendent: {
    defaultRoute: '/approvals',
    label: 'Approval Queue',
    description: 'Review and approve lookahead submissions',
  },

  // Planning - project overview
  scheduler: {
    defaultRoute: '/schedules',
    label: 'Schedules',
    description: 'Manage project schedules and activities',
  },
  project_manager: {
    defaultRoute: '/projects',
    label: 'Projects',
    description: 'Overview of all projects and their status',
  },

  // Executive - dashboard
  executive: {
    defaultRoute: '/dashboard/portfolio',
    label: 'Portfolio Dashboard',
    description: 'Executive overview of portfolio health',
  },

  // Admin - full access
  admin: {
    defaultRoute: '/dashboard',
    label: 'Dashboard',
    description: 'System administration and overview',
  },

  // Viewer - read-only dashboard
  viewer: {
    defaultRoute: '/dashboard',
    label: 'Dashboard',
    description: 'View project information and reports',
  },
};

// ============================================
// Fallback route for unknown roles
// ============================================

const fallbackRoute: RoleRouteConfig = {
  defaultRoute: '/dashboard',
  label: 'Dashboard',
  description: 'Application dashboard',
};

// ============================================
// Local Storage Key for Preference Override
// ============================================

const LANDING_PREFERENCE_KEY = 'scheduler-landing-preference';

// ============================================
// Hook Implementation
// ============================================

interface UseRoleBasedLandingReturn {
  /** The default route for the current user's role */
  defaultRoute: string;
  /** Navigate to the role-appropriate landing page */
  navigateToDefault: () => void;
  /** Get route config for a specific role */
  getRouteConfig: (role: UserRole) => RoleRouteConfig;
  /** Current user's role */
  userRole: UserRole | null;
  /** Whether the user has a custom landing preference */
  hasCustomPreference: boolean;
  /** Set a custom landing preference (overrides role default) */
  setLandingPreference: (route: string | null) => void;
  /** Get the effective landing route (considers preferences) */
  getEffectiveLandingRoute: () => string;
  /** Route label for display */
  routeLabel: string;
  /** Route description for display */
  routeDescription: string;
}

export function useRoleBasedLanding(): UseRoleBasedLandingReturn {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  
  // Parse user role
  const userRole = useMemo<UserRole | null>(() => {
    if (!user?.role) return null;
    
    // Normalize role string to match our types
    const normalizedRole = user.role.toLowerCase().replace(/\s+/g, '_') as UserRole;
    
    // Check if it's a valid role
    if (normalizedRole in roleRouteMap) {
      return normalizedRole;
    }
    
    return null;
  }, [user?.role]);

  // Get route config for current user
  const routeConfig = useMemo(() => {
    if (!userRole) return fallbackRoute;
    return roleRouteMap[userRole] || fallbackRoute;
  }, [userRole]);

  // Check for custom preference
  const customPreference = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LANDING_PREFERENCE_KEY);
  }, []);

  const hasCustomPreference = !!customPreference;

  // Get route config for any role
  const getRouteConfig = useCallback((role: UserRole): RoleRouteConfig => {
    return roleRouteMap[role] || fallbackRoute;
  }, []);

  // Get effective landing route (preference > role default)
  const getEffectiveLandingRoute = useCallback((): string => {
    if (customPreference) {
      return customPreference;
    }
    return routeConfig.defaultRoute;
  }, [customPreference, routeConfig.defaultRoute]);

  // Navigate to default route
  const navigateToDefault = useCallback(() => {
    const route = getEffectiveLandingRoute();
    navigate(route);
  }, [navigate, getEffectiveLandingRoute]);

  // Set custom landing preference
  const setLandingPreference = useCallback((route: string | null) => {
    if (route === null) {
      localStorage.removeItem(LANDING_PREFERENCE_KEY);
    } else {
      localStorage.setItem(LANDING_PREFERENCE_KEY, route);
    }
  }, []);

  return {
    defaultRoute: routeConfig.defaultRoute,
    navigateToDefault,
    getRouteConfig,
    userRole,
    hasCustomPreference,
    setLandingPreference,
    getEffectiveLandingRoute,
    routeLabel: routeConfig.label,
    routeDescription: routeConfig.description,
  };
}

// ============================================
// Utility: Check if user has specific role
// ============================================

export function isFieldRole(role: UserRole | null): boolean {
  return role === 'field_crew' || role === 'subcontractor';
}

export function isSupervisoryRole(role: UserRole | null): boolean {
  return role === 'superintendent' || role === 'project_manager';
}

export function isPlanningRole(role: UserRole | null): boolean {
  return role === 'scheduler' || role === 'project_manager';
}

export function isExecutiveRole(role: UserRole | null): boolean {
  return role === 'executive' || role === 'admin';
}

// ============================================
// Default Export
// ============================================

export default useRoleBasedLanding;
