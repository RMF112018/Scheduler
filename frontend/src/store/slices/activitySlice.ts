import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { activityApi } from '@services/api/activityApi';

// Types
export interface Activity {
  id: string;
  scheduleId: string;
  persistentInternalGuid: string;
  externalGuid?: string;
  activityCode?: string;
  name: string;
  startDate: string;
  finishDate: string;
  duration: number;
  percentComplete: number;
  predecessorIds: string[];
  successorIds: string[];
  resourceIds: string[];
  totalFloat?: number;
  isCritical?: boolean;
  isAtRisk?: boolean;
  isDelayed?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ActivityState {
  activities: Activity[];
  selectedActivityId: string | null;
  loading: boolean;
  error: string | null;
  filter: {
    search: string;
    status: string | null;
    dateRange: { start: string | null; end: string | null };
  };
}

// Initial state
const initialState: ActivityState = {
  activities: [],
  selectedActivityId: null,
  loading: false,
  error: null,
  filter: {
    search: '',
    status: null,
    dateRange: { start: null, end: null },
  },
};

// Async thunks
export const fetchActivities = createAsyncThunk<Activity[], string>(
  'activity/fetchAll',
  async (scheduleId, { rejectWithValue }) => {
    try {
      return await activityApi.getActivities(scheduleId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch activities';
      return rejectWithValue(errorMessage);
    }
  }
);

export const createActivity = createAsyncThunk<Activity, Partial<Activity>>(
  'activity/create',
  async (data, { rejectWithValue }) => {
    try {
      return await activityApi.createActivity(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create activity';
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateActivity = createAsyncThunk<
  Activity,
  { id: string; data: Partial<Activity> }
>('activity/update', async ({ id, data }, { rejectWithValue }) => {
  try {
    return await activityApi.updateActivity(id, data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update activity';
    return rejectWithValue(errorMessage);
  }
});

export const deleteActivity = createAsyncThunk<string, string>(
  'activity/delete',
  async (activityId, { rejectWithValue }) => {
    try {
      await activityApi.deleteActivity(activityId);
      return activityId;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete activity';
      return rejectWithValue(errorMessage);
    }
  }
);

// Slice
const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    selectActivity: (state, action: PayloadAction<string | null>) => {
      state.selectedActivityId = action.payload;
    },
    setActivities: (state, action: PayloadAction<Activity[]>) => {
      state.activities = action.payload;
    },
    setFilter: (
      state,
      action: PayloadAction<Partial<ActivityState['filter']>>
    ) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    clearFilter: (state) => {
      state.filter = initialState.filter;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch activities
      .addCase(fetchActivities.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActivities.fulfilled, (state, action) => {
        state.loading = false;
        state.activities = action.payload;
      })
      .addCase(fetchActivities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create activity
      .addCase(createActivity.fulfilled, (state, action) => {
        state.activities.push(action.payload);
      })
      // Update activity
      .addCase(updateActivity.fulfilled, (state, action) => {
        const index = state.activities.findIndex((a) => a.id === action.payload.id);
        if (index !== -1) {
          state.activities[index] = action.payload;
        }
      })
      // Delete activity
      .addCase(deleteActivity.fulfilled, (state, action) => {
        state.activities = state.activities.filter((a) => a.id !== action.payload);
        if (state.selectedActivityId === action.payload) {
          state.selectedActivityId = null;
        }
      });
  },
});

export const {
  clearError,
  selectActivity,
  setActivities,
  setFilter,
  clearFilter,
} = activitySlice.actions;
export default activitySlice.reducer;
