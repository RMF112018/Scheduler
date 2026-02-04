import apiClient from './client';
import type {
  LookaheadSchedule,
  LookaheadActivity,
  Conflict,
} from '@store/slices/lookaheadSlice';

export const lookaheadApi = {
  async getLookaheads(projectId: string): Promise<LookaheadSchedule[]> {
    const response = await apiClient.get<LookaheadSchedule[]>(
      `/projects/${projectId}/lookaheads`
    );
    return response.data;
  },

  async getLookahead(lookaheadId: string): Promise<LookaheadSchedule> {
    const response = await apiClient.get<LookaheadSchedule>(`/lookaheads/${lookaheadId}`);
    return response.data;
  },

  async createLookahead(data: {
    masterScheduleId: string;
    projectId: string;
    name: string;
    startDate: string;
    endDate: string;
  }): Promise<LookaheadSchedule> {
    const response = await apiClient.post<LookaheadSchedule>('/lookaheads', data);
    return response.data;
  },

  async pullFromMaster(lookaheadId: string): Promise<LookaheadSchedule> {
    const response = await apiClient.post<LookaheadSchedule>(
      `/lookaheads/${lookaheadId}/pull`
    );
    return response.data;
  },

  async markTaskStatus(
    lookaheadId: string,
    activityId: string,
    status: 'should_do' | 'will_do'
  ): Promise<LookaheadActivity> {
    const response = await apiClient.put<LookaheadActivity>(
      `/lookaheads/${lookaheadId}/activities/${activityId}/status`,
      { status }
    );
    return response.data;
  },

  async commitChanges(lookaheadId: string): Promise<LookaheadSchedule> {
    const response = await apiClient.post<LookaheadSchedule>(
      `/lookaheads/${lookaheadId}/commit`
    );
    return response.data;
  },

  async checkConflicts(lookaheadId: string, activityId?: string): Promise<Conflict[]> {
    const url = activityId
      ? `/lookaheads/${lookaheadId}/conflicts?activityId=${activityId}`
      : `/lookaheads/${lookaheadId}/conflicts`;
    const response = await apiClient.get<Conflict[]>(url);
    return response.data;
  },

  async updateActivity(
    lookaheadId: string,
    activityId: string,
    data: Partial<LookaheadActivity>
  ): Promise<LookaheadActivity> {
    const response = await apiClient.put<LookaheadActivity>(
      `/lookaheads/${lookaheadId}/activities/${activityId}`,
      data
    );
    return response.data;
  },
};
