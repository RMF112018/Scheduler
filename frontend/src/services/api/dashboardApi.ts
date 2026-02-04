import apiClient from './client';
import type { ExecutiveDashboardData } from '@store/slices/dashboardSlice';

interface FinancialDrillDown {
  summary: {
    totalSpend: number;
    remainingBudget: number;
    budgetUtilization: number;
  };
  budgetVsActual: Array<{
    category: string;
    budgeted: number;
    actual: number;
    variance: number;
    variancePercent: number;
  }>;
  varianceAnalysis: Array<{
    activityId: string;
    activityName: string;
    budgeted: number;
    actual: number;
    variance: number;
    reason?: string;
  }>;
}

export const dashboardApi = {
  async getExecutiveDashboard(): Promise<ExecutiveDashboardData> {
    const response = await apiClient.get<ExecutiveDashboardData>('/dashboard/executive');
    return response.data;
  },

  async getFinancialDrillDown(projectId: string): Promise<FinancialDrillDown> {
    const response = await apiClient.get<FinancialDrillDown>(
      `/dashboard/financial/${projectId}`
    );
    return response.data;
  },

  async getProjectProgress(projectId: string): Promise<unknown> {
    const response = await apiClient.get(`/dashboard/progress/${projectId}`);
    return response.data;
  },

  async getCriticalDelays(projectId?: string): Promise<unknown> {
    const url = projectId
      ? `/dashboard/delays?projectId=${projectId}`
      : '/dashboard/delays';
    const response = await apiClient.get(url);
    return response.data;
  },
};
