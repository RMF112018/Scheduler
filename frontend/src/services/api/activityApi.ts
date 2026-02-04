import apiClient from './client';
import type { Activity } from '@store/slices/activitySlice';

export const activityApi = {
  async getActivities(scheduleId: string): Promise<Activity[]> {
    const response = await apiClient.get<Activity[]>(`/schedules/${scheduleId}/activities`);
    return response.data;
  },

  async getActivity(activityId: string): Promise<Activity> {
    const response = await apiClient.get<Activity>(`/activities/${activityId}`);
    return response.data;
  },

  async createActivity(data: Partial<Activity>): Promise<Activity> {
    const response = await apiClient.post<Activity>('/activities', data);
    return response.data;
  },

  async updateActivity(activityId: string, data: Partial<Activity>): Promise<Activity> {
    const response = await apiClient.put<Activity>(`/activities/${activityId}`, data);
    return response.data;
  },

  async deleteActivity(activityId: string): Promise<void> {
    await apiClient.delete(`/activities/${activityId}`);
  },

  async addRelationship(
    predecessorId: string,
    successorId: string,
    type: 'FS' | 'SS' | 'FF' | 'SF'
  ): Promise<void> {
    await apiClient.post('/activities/relationships', {
      predecessorId,
      successorId,
      type,
    });
  },

  async removeRelationship(predecessorId: string, successorId: string): Promise<void> {
    await apiClient.delete(
      `/activities/relationships?predecessor=${predecessorId}&successor=${successorId}`
    );
  },
};
