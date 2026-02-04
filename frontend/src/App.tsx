import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';

// Layout components
import Layout from '@components/common/Layout';

// Page components (placeholders for now)
import Dashboard from '@components/dashboards/Dashboard';
import ScheduleList from '@components/schedules/ScheduleList';
import ScheduleDetail from '@components/schedules/ScheduleDetail';
import LookaheadView from '@components/lookahead/LookaheadView';
import Login from '@components/common/Login';
import NotFound from '@components/common/NotFound';

// Auth wrapper
import ProtectedRoute from '@components/common/ProtectedRoute';

function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedules" element={<ScheduleList />} />
            <Route path="/schedules/:scheduleId" element={<ScheduleDetail />} />
            <Route path="/lookahead/:lookaheadId" element={<LookaheadView />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Box>
  );
}

export default App;
