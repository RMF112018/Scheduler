import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardApi } from '@services/api/dashboardApi';

// Types
export interface ProjectProgress {
  projectId: string;
  projectName: string;
  status: 'on_track' | 'at_risk' | 'delayed' | 'critical';
  overallProgress: number;
  schedulePerformanceIndex: number;
  costPerformanceIndex: number;
  criticalPathHealth: 'healthy' | 'at_risk' | 'delayed';
  activitiesTotal: number;
  activitiesCompleted: number;
  activitiesInProgress: number;
  activitiesDelayed: number;
  daysRemaining: number;
  lastApprovedUpdate: string | null;
}

export interface DelayAlert {
  projectId: string;
  projectName: string;
  activityId: string;
  activityCode: string;
  activityName: string;
  plannedFinish: string | Date;
  forecastFinish: string | Date;
  delayDays: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  isCriticalPath: boolean;
  cause?: string;
}

export interface FinancialSummary {
  projectId: string;
  projectName: string;
  budgetedCost: number;
  actualCost: number;
  earnedValue: number;
  plannedValue: number;
  costVariance: number;
  scheduleVariance: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
}

export interface ExecutiveDashboardData {
  summary?: {
    totalProjects: number;
    projectsOnTrack: number;
    projectsAtRisk: number;
    projectsDelayed: number;
    overallPortfolioHealth: 'healthy' | 'at_risk' | 'critical';
    totalBudget: number;
    totalSpent: number;
    budgetUtilization: number;
  };
  projects: ProjectProgress[];
  criticalDelays: DelayAlert[];
  financials: FinancialSummary[]; // Backend returns 'financials' (plural)
  resourceUtilization?: unknown[];
  lastUpdated: string;
  dataIntegrityNote?: string;
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
