import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAppSelector, useAppDispatch } from '@store/index';
import { getCurrentUser } from '@store/slices/authSlice';

const ProtectedRoute: React.FC = () => {
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

  return <Outlet />;
};

export default ProtectedRoute;
