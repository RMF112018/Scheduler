/**
 * Utility functions for authentication token management
 */

/**
 * Clear all authentication tokens from localStorage
 * This ensures a clean logout and prevents stale tokens from causing issues
 */
export function clearAuthTokens(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
}

/**
 * Check if authentication tokens exist in localStorage
 */
export function hasAuthTokens(): boolean {
  return !!(localStorage.getItem('token') || localStorage.getItem('refreshToken'));
}
