import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';

export class DashboardController {
  async getExecutiveDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId;

      // Get projects for user's company
      const projects = await prisma.project.findMany({
        where: { companyId },
        include: {
          schedules: {
            include: {
              activities: true,
            },
          },
        },
      });

      // Calculate project progress
      const projectProgress = projects.map((project) => {
        const allActivities = project.schedules.flatMap((s) => s.activities);
        const totalActivities = allActivities.length;
        const completedActivities = allActivities.filter(
          (a) => a.percentComplete === 100
        ).length;
        const progress =
          totalActivities > 0
            ? Math.round((completedActivities / totalActivities) * 100)
            : 0;

        return {
          id: project.id,
          name: project.name,
          progress,
          status: progress >= 90 ? 'on_track' : progress >= 70 ? 'at_risk' : 'delayed',
          activitiesTotal: totalActivities,
          activitiesCompleted: completedActivities,
        };
      });

      // TODO: Implement critical delays and financial data
      res.json({
        projects: projectProgress,
        criticalDelays: [],
        financial: [],
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async getFinancialDrillDown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      // TODO: Implement financial drill-down
      res.json({
        summary: {
          totalSpend: 0,
          remainingBudget: 0,
          budgetUtilization: 0,
        },
        budgetVsActual: [],
        varianceAnalysis: [],
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          schedules: {
            include: {
              activities: true,
            },
          },
        },
      });

      if (!project) {
        res.status(404).json({ message: 'Project not found' });
        return;
      }

      const allActivities = project.schedules.flatMap((s) => s.activities);
      const totalActivities = allActivities.length;
      const completedActivities = allActivities.filter(
        (a) => a.percentComplete === 100
      ).length;

      res.json({
        projectId,
        projectName: project.name,
        totalActivities,
        completedActivities,
        progress:
          totalActivities > 0
            ? Math.round((completedActivities / totalActivities) * 100)
            : 0,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCriticalDelays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // TODO: Implement critical delays logic
      res.json([]);
    } catch (error) {
      next(error);
    }
  }
}
