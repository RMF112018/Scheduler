/**
 * Dashboard Controller
 *
 * Handles HTTP requests for dashboard data including:
 * - Executive dashboard with portfolio overview
 * - Project drill-down with detailed metrics
 * - Financial drill-down with budget vs actual
 * - Critical delays and risk analysis
 */

import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboardService.js';
import { NotFoundError } from '../utils/errors.js';

export class DashboardController {
  /**
   * Get executive dashboard with workflow-gated data
   */
  async getExecutiveDashboard(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId;

      const dashboard = await dashboardService.getExecutiveDashboard(companyId);

      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get detailed project drill-down
   */
  async getProjectDrillDown(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        throw new NotFoundError('Project ID is required');
      }

      const drillDown = await dashboardService.getProjectDrillDown(projectId);

      res.json(drillDown);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get financial drill-down for a project
   */
  async getFinancialDrillDown(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        throw new NotFoundError('Project ID is required');
      }

      const financials = await dashboardService.getFinancialDrillDown(projectId);

      res.json(financials);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get project progress summary
   */
  async getProjectProgress(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        throw new NotFoundError('Project ID is required');
      }

      const drillDown = await dashboardService.getProjectDrillDown(projectId);

      res.json({
        projectId: drillDown.project.projectId,
        projectName: drillDown.project.projectName,
        totalActivities: drillDown.project.activitiesTotal,
        completedActivities: drillDown.project.activitiesCompleted,
        progress: drillDown.project.overallProgress,
        status: drillDown.project.status,
        schedulePerformanceIndex: drillDown.project.schedulePerformanceIndex,
        criticalPathHealth: drillDown.project.criticalPathHealth,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get critical delays across all projects
   */
  async getCriticalDelays(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId;
      const { limit } = req.query;

      const dashboard = await dashboardService.getExecutiveDashboard(companyId);
      const maxDelays = limit ? parseInt(limit as string, 10) : 20;

      res.json({
        delays: dashboard.criticalDelays.slice(0, maxDelays),
        totalCount: dashboard.criticalDelays.length,
        summary: {
          critical: dashboard.criticalDelays.filter((d) => d.impact === 'critical')
            .length,
          high: dashboard.criticalDelays.filter((d) => d.impact === 'high').length,
          medium: dashboard.criticalDelays.filter((d) => d.impact === 'medium').length,
          low: dashboard.criticalDelays.filter((d) => d.impact === 'low').length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get resource utilization summary
   */
  async getResourceUtilization(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId;

      const dashboard = await dashboardService.getExecutiveDashboard(companyId);

      res.json({
        utilization: dashboard.resourceUtilization,
        summary: {
          totalRoles: dashboard.resourceUtilization.length,
          averageUtilization:
            dashboard.resourceUtilization.length > 0
              ? Math.round(
                  dashboard.resourceUtilization.reduce(
                    (sum, r) => sum + r.utilizationPercentage,
                    0
                  ) / dashboard.resourceUtilization.length
                )
              : 0,
          overAllocatedStaff: dashboard.resourceUtilization.reduce(
            (sum, r) => sum + r.overAllocatedCount,
            0
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get portfolio health summary
   */
  async getPortfolioHealth(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId;

      const dashboard = await dashboardService.getExecutiveDashboard(companyId);

      res.json({
        health: dashboard.summary.overallPortfolioHealth,
        projects: {
          total: dashboard.summary.totalProjects,
          onTrack: dashboard.summary.projectsOnTrack,
          atRisk: dashboard.summary.projectsAtRisk,
          delayed: dashboard.summary.projectsDelayed,
        },
        budget: {
          total: dashboard.summary.totalBudget,
          spent: dashboard.summary.totalSpent,
          utilization: dashboard.summary.budgetUtilization,
        },
        lastUpdated: dashboard.lastUpdated,
        dataIntegrityNote: dashboard.dataIntegrityNote,
      });
    } catch (error) {
      next(error);
    }
  }
}
