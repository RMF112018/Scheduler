import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardApi } from '@services/api/dashboardApi';

// Types
export interface ProjectProgress {
  id: string;
  name: string;
  progress: number;
  status: 'on_track' | 'at_risk' | 'delayed';
  activitiesTotal: number;
  activitiesCompleted: number;
}

export interface DelayAlert {
  id: string;
  projectId: string;
  projectName: string;
  activityId: string;
  activityName: string;
  delayDays: number;
  isCriticalPath: boolean;
  impact: string;
}

export interface FinancialSummary {
  projectId: string;
  projectName: string;
  totalBudget: number;
  totalSpend: number;
  remainingBudget: number;
  budgetUtilization: number;
}

export interface ExecutiveDashboardData {
  projects: ProjectProgress[];
  criticalDelays: DelayAlert[];
  financial: FinancialSummary[];
  lastUpdated: string;
}

interface DashboardState {
  executive: ExecutiveDashboardData | null;
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: DashboardState = {
  executive: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchExecutiveDashboard = createAsyncThunk<ExecutiveDashboardData>(
  'dashboard/fetchExecutive',
  async (_, { rejectWithValue }) => {
    try {
      return await dashboardApi.getExecutiveDashboard();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch dashboard';
      return rejectWithValue(errorMessage);
    }
  }
);

// Slice
const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExecutiveDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExecutiveDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.executive = action.payload;
      })
      .addCase(fetchExecutiveDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = dashboardSlice.actions;
export default dashboardSlice.reducer;
