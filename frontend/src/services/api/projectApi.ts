import apiClient from './client';
import type { Project } from '@shared/index';

export const projectApi = {
  async getProjects(): Promise<Project[]> {
    const response = await apiClient.get<Project[]>('/projects');
    return response.data;
  },

  async getProject(projectId: string): Promise<Project> {
    const response = await apiClient.get<Project>(`/projects/${projectId}`);
    return response.data;
  },
};
