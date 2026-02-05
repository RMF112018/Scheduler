import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { lookaheadApi } from '@services/api/lookaheadApi';

// Types
export interface LookaheadActivity {
  id: string;
  lookaheadScheduleId: string;
  persistentInternalGuid: string;
  name: string;
  startDate: string;
  finishDate: string;
  duration: number;
  percentComplete: number;
  plannerStatus: 'should_do' | 'will_do' | null;
  plannerUpdatedBy?: string;
  plannerUpdatedAt?: string;
  hasConflict: boolean;
  conflicts?: Conflict[];
  isCommitted: boolean;
  hasPostCommitTweaks: boolean;
}

export interface Conflict {
  type: 'zero_float_violation' | 'resource_conflict' | 'predecessor_violation';
  activityId: string;
  activityName: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface LookaheadSchedule {
  id: string;
  masterScheduleId: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'submitted' | 'approved' | 'rejected';
  activities: LookaheadActivity[];
  conflicts?: Conflict[]; // Optional - conflicts are fetched separately
  hasUncommittedChanges?: boolean;
  hasPostCommitTweaks?: boolean;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface LookaheadState {
  lookaheads: LookaheadSchedule[];
  current: LookaheadSchedule | null;
  loading: boolean;
  error: string | null;
  viewMode: 'calendar' | 'list';
}

// Initial state
const initialState: LookaheadState = {
  lookaheads: [],
  current: null,
  loading: false,
  error: null,
  viewMode: 'calendar',
};

// Async thunks
export const fetchLookaheads = createAsyncThunk<LookaheadSchedule[], string>(
  'lookahead/fetchAll',
  async (projectId, { rejectWithValue }) => {
    try {
      return await lookaheadApi.getLookaheads(projectId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch lookaheads';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchLookahead = createAsyncThunk<LookaheadSchedule, string>(
  'lookahead/fetch',
  async (lookaheadId, { rejectWithValue }) => {
    try {
      return await lookaheadApi.getLookahead(lookaheadId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch lookahead';
      return rejectWithValue(errorMessage);
    }
  }
);

export const markTaskStatus = createAsyncThunk<
  LookaheadActivity,
  { lookaheadId: string; activityId: string; status: 'should_do' | 'will_do' }
>('lookahead/markTaskStatus', async ({ lookaheadId, activityId, status }, { rejectWithValue }) => {
  try {
    return await lookaheadApi.markTaskStatus(lookaheadId, activityId, status);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update task status';
    return rejectWithValue(errorMessage);
  }
});

export const commitLookaheadChanges = createAsyncThunk<LookaheadSchedule, string>(
  'lookahead/commit',
  async (lookaheadId, { rejectWithValue }) => {
    try {
      return await lookaheadApi.commitChanges(lookaheadId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to commit changes';
      return rejectWithValue(errorMessage);
    }
  }
);

export const checkConflicts = createAsyncThunk<
  Conflict[],
  { lookaheadId: string; activityId?: string }
>('lookahead/checkConflicts', async ({ lookaheadId, activityId }, { rejectWithValue }) => {
  try {
    return await lookaheadApi.checkConflicts(lookaheadId, activityId);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check conflicts';
    return rejectWithValue(errorMessage);
  }
});

// Slice
const lookaheadSlice = createSlice({
  name: 'lookahead',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setViewMode: (state, action: PayloadAction<'calendar' | 'list'>) => {
      state.viewMode = action.payload;
    },
    setCurrentLookahead: (state, action: PayloadAction<LookaheadSchedule | null>) => {
      state.current = action.payload;
    },
    showConflictAlert: (
      state,
      action: PayloadAction<{ activityId: string; conflicts: Conflict[] }>
    ) => {
      if (state.current) {
        const safeConflicts = Array.isArray(action.payload.conflicts) 
          ? action.payload.conflicts 
          : [];
        const activity = state.current.activities.find(
          (a) => a.id === action.payload.activityId
        );
        if (activity) {
          activity.hasConflict = true;
          activity.conflicts = safeConflicts;
        }
        const existingConflicts = state.current.conflicts || [];
        state.current.conflicts = [
          ...existingConflicts.filter(
            (c) => c.activityId !== action.payload.activityId
          ),
          ...safeConflicts,
        ];
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch lookaheads
      .addCase(fetchLookaheads.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLookaheads.fulfilled, (state, action) => {
        state.loading = false;
        state.lookaheads = action.payload;
      })
      .addCase(fetchLookaheads.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch single lookahead
      .addCase(fetchLookahead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLookahead.fulfilled, (state, action) => {
        state.loading = false;
        state.current = {
          ...action.payload,
          activities: action.payload.activities || [],
          conflicts: action.payload.conflicts || [],
        };
      })
      .addCase(fetchLookahead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Mark task status
      .addCase(markTaskStatus.fulfilled, (state, action) => {
        if (state.current) {
          const index = state.current.activities.findIndex(
            (a) => a.id === action.payload.id
          );
          if (index !== -1) {
            state.current.activities[index] = action.payload;
          }
          state.current.hasUncommittedChanges = true;
        }
      })
      // Commit changes
      .addCase(commitLookaheadChanges.fulfilled, (state, action) => {
        state.current = action.payload;
        const index = state.lookaheads.findIndex((l) => l.id === action.payload.id);
        if (index !== -1) {
          state.lookaheads[index] = action.payload;
        }
      })
      // Check conflicts
      .addCase(checkConflicts.fulfilled, (state, action) => {
        if (state.current) {
          // Ensure conflicts is always an array
          state.current.conflicts = Array.isArray(action.payload) ? action.payload : [];
        }
      });
  },
});

export const {
  clearError,
  setViewMode,
  setCurrentLookahead,
  showConflictAlert,
} = lookaheadSlice.actions;
export default lookaheadSlice.reducer;
