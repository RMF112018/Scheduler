/**
 * Admin Route Protection
 *
 * Phase 11: Protects admin-only routes by checking for administrator role.
 */

import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useAppSelector, useAppDispatch } from '@store/index';
import { getCurrentUser } from '@store/slices/authSlice';

const AdminRoute: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { isAuthenticated, loading, user, token } = useAppSelector((state) => state.auth);

  // Validate token on mount if token exists but we're not authenticated yet
  useEffect(() => {
    if (token && !isAuthenticated && !loading && !user) {
      dispatch(getCurrentUser());
    }
  }, [token, isAuthenticated, loading, user, dispatch]);

  // Show loading while checking auth
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has admin role
  // Phase 11: Check both legacy role field and UserRole assignments
  const isAdmin =
    user?.role === 'admin' ||
    user?.role === 'administrator' ||
    (user as any)?.roles?.some((r: any) => r.name === 'administrator' || r.name === 'admin');

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Administrator role required to access this page.
        </Alert>
      </Box>
    );
  }

  return <Outlet />;
};

export default AdminRoute;
