import apiClient from './client';
import type { Schedule, Baseline } from '@store/slices/scheduleSlice';

export const scheduleApi = {
  async getSchedules(projectId: string): Promise<Schedule[]> {
    const response = await apiClient.get<Schedule[]>(`/projects/${projectId}/schedules`);
    return response.data;
  },

  async getSchedule(scheduleId: string): Promise<Schedule> {
    const response = await apiClient.get<Schedule>(`/schedules/${scheduleId}`);
    return response.data;
  },

  async createSchedule(data: Partial<Schedule>): Promise<Schedule> {
    const response = await apiClient.post<Schedule>('/schedules', data);
    return response.data;
  },

  async updateSchedule(scheduleId: string, data: Partial<Schedule>): Promise<Schedule> {
    const response = await apiClient.put<Schedule>(`/schedules/${scheduleId}`, data);
    return response.data;
  },

  async deleteSchedule(scheduleId: string): Promise<void> {
    await apiClient.delete(`/schedules/${scheduleId}`);
  },

  async getBaselines(scheduleId: string): Promise<Baseline[]> {
    const response = await apiClient.get<Baseline[]>(`/schedules/${scheduleId}/baselines`);
    return response.data;
  },

  async createBaseline(scheduleId: string): Promise<Baseline> {
    const response = await apiClient.post<Baseline>(`/schedules/${scheduleId}/baselines`);
    return response.data;
  },

  async compareBaselines(
    scheduleId: string,
    baseline1Id: string,
    baseline2Id: string
  ): Promise<unknown> {
    const response = await apiClient.get(
      `/schedules/${scheduleId}/baselines/compare?baseline1=${baseline1Id}&baseline2=${baseline2Id}`
    );
    return response.data;
  },
};
