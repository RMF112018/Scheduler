import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@store/index';
import { getCurrentUser } from '@store/slices/authSlice';

// Layout components
import Layout from '@components/common/Layout';

// Page components (placeholders for now)
import Dashboard from '@components/dashboards/Dashboard';
import ScheduleList from '@components/schedules/ScheduleList';
import ScheduleDetail from '@components/schedules/ScheduleDetail';
import ScheduleForm from '@components/schedules/ScheduleForm';
import LookaheadList from '@components/lookahead/LookaheadList';
import LookaheadView from '@components/lookahead/LookaheadView';
import Login from '@components/common/Login';
import Register from '@components/common/Register';
import Settings from '@components/settings/Settings';
import NotFound from '@components/common/NotFound';
import { UserManagementView } from '@components/admin';

// Auth wrapper
import ProtectedRoute from '@components/common/ProtectedRoute';
import AdminRoute from '@components/common/AdminRoute';

function App() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { token, isAuthenticated, loading } = useAppSelector((state) => state.auth);

  // Validate token on app startup if token exists
  // Skip validation on login/register pages to prevent auto-login issues
  useEffect(() => {
    const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
    if (token && !isAuthenticated && !loading && !isAuthPage) {
      dispatch(getCurrentUser());
    }
  }, [token, isAuthenticated, loading, location.pathname, dispatch]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedules" element={<ScheduleList />} />
            <Route path="/schedules/new" element={<ScheduleForm />} />
            <Route path="/schedules/:scheduleId" element={<ScheduleDetail />} />
            <Route path="/lookahead" element={<LookaheadList />} />
            <Route path="/lookahead/:lookaheadId" element={<LookaheadView />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          {/* Admin routes */}
          <Route element={<AdminRoute />}>
            <Route element={<Layout />}>
              <Route path="/admin/users" element={<UserManagementView />} />
            </Route>
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Box>
  );
}

export default App;
