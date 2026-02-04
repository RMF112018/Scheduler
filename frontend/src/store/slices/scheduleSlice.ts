import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { scheduleApi } from '@services/api/scheduleApi';

// Types
export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Baseline {
  id: string;
  scheduleId: string;
  version: number;
  createdAt: string;
  snapshotData: Record<string, unknown>;
}

interface ScheduleState {
  schedules: Schedule[];
  currentSchedule: Schedule | null;
  baselines: Baseline[];
  selectedBaselineId: string | null;
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: ScheduleState = {
  schedules: [],
  currentSchedule: null,
  baselines: [],
  selectedBaselineId: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchSchedules = createAsyncThunk<Schedule[], string>(
  'schedule/fetchAll',
  async (projectId, { rejectWithValue }) => {
    try {
      return await scheduleApi.getSchedules(projectId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch schedules';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchSchedule = createAsyncThunk<Schedule, string>(
  'schedule/fetch',
  async (scheduleId, { rejectWithValue }) => {
    try {
      return await scheduleApi.getSchedule(scheduleId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch schedule';
      return rejectWithValue(errorMessage);
    }
  }
);

export const createSchedule = createAsyncThunk<Schedule, Partial<Schedule>>(
  'schedule/create',
  async (data, { rejectWithValue }) => {
    try {
      return await scheduleApi.createSchedule(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create schedule';
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateSchedule = createAsyncThunk<
  Schedule,
  { id: string; data: Partial<Schedule> }
>('schedule/update', async ({ id, data }, { rejectWithValue }) => {
  try {
    return await scheduleApi.updateSchedule(id, data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update schedule';
    return rejectWithValue(errorMessage);
  }
});

export const deleteSchedule = createAsyncThunk<string, string>(
  'schedule/delete',
  async (scheduleId, { rejectWithValue }) => {
    try {
      await scheduleApi.deleteSchedule(scheduleId);
      return scheduleId;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchBaselines = createAsyncThunk<Baseline[], string>(
  'schedule/fetchBaselines',
  async (scheduleId, { rejectWithValue }) => {
    try {
      return await scheduleApi.getBaselines(scheduleId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch baselines';
      return rejectWithValue(errorMessage);
    }
  }
);

export const createBaseline = createAsyncThunk<Baseline, string>(
  'schedule/createBaseline',
  async (scheduleId, { rejectWithValue }) => {
    try {
      return await scheduleApi.createBaseline(scheduleId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create baseline';
      return rejectWithValue(errorMessage);
    }
  }
);

// Slice
const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentSchedule: (state, action: PayloadAction<Schedule | null>) => {
      state.currentSchedule = action.payload;
    },
    selectBaseline: (state, action: PayloadAction<string | null>) => {
      state.selectedBaselineId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all schedules
      .addCase(fetchSchedules.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSchedules.fulfilled, (state, action) => {
        state.loading = false;
        state.schedules = action.payload;
      })
      .addCase(fetchSchedules.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch single schedule
      .addCase(fetchSchedule.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSchedule.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSchedule = action.payload;
      })
      .addCase(fetchSchedule.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create schedule
      .addCase(createSchedule.fulfilled, (state, action) => {
        state.schedules.push(action.payload);
      })
      // Update schedule
      .addCase(updateSchedule.fulfilled, (state, action) => {
        const index = state.schedules.findIndex((s) => s.id === action.payload.id);
        if (index !== -1) {
          state.schedules[index] = action.payload;
        }
        if (state.currentSchedule?.id === action.payload.id) {
          state.currentSchedule = action.payload;
        }
      })
      // Delete schedule
      .addCase(deleteSchedule.fulfilled, (state, action) => {
        state.schedules = state.schedules.filter((s) => s.id !== action.payload);
        if (state.currentSchedule?.id === action.payload) {
          state.currentSchedule = null;
        }
      })
      // Fetch baselines
      .addCase(fetchBaselines.fulfilled, (state, action) => {
        state.baselines = action.payload;
      })
      // Create baseline
      .addCase(createBaseline.fulfilled, (state, action) => {
        state.baselines.push(action.payload);
        // Keep only 5 baselines (newest first)
        if (state.baselines.length > 5) {
          state.baselines = state.baselines
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
        }
      });
  },
});

export const { clearError, setCurrentSchedule, selectBaseline } = scheduleSlice.actions;
export default scheduleSlice.reducer;
