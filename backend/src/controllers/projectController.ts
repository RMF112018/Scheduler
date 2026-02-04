import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class ProjectController {
  async getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projects = await prisma.project.findMany({
        where: { companyId: req.user!.companyId },
        orderBy: { createdAt: 'desc' },
      });

      res.json(projects);
    } catch (error) {
      next(error);
    }
  }

  async getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          companyId: req.user!.companyId,
        },
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      res.json(project);
    } catch (error) {
      next(error);
    }
  }

  async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, startDate, endDate, metadata } = req.body;

      const project = await prisma.project.create({
        data: {
          name,
          description,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          metadata,
          companyId: req.user!.companyId,
          createdBy: req.user!.id,
        },
      });

      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }

  async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const { name, description, startDate, endDate, metadata } = req.body;

      const project = await prisma.project.updateMany({
        where: {
          id: projectId,
          companyId: req.user!.companyId,
        },
        data: {
          name,
          description,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          metadata,
          updatedAt: new Date(),
        },
      });

      if (project.count === 0) {
        throw new NotFoundError('Project not found');
      }

      const updated = await prisma.project.findUnique({ where: { id: projectId } });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      const result = await prisma.project.deleteMany({
        where: {
          id: projectId,
          companyId: req.user!.companyId,
        },
      });

      if (result.count === 0) {
        throw new NotFoundError('Project not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async getProjectSchedules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      const schedules = await prisma.schedule.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      res.json(schedules);
    } catch (error) {
      next(error);
    }
  }

  async getProjectLookaheads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      const lookaheads = await prisma.lookaheadSchedule.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      res.json(lookaheads);
    } catch (error) {
      next(error);
    }
  }
}
