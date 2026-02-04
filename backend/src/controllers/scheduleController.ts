import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class ScheduleController {
  async getSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          project: true,
        },
      });

      if (!schedule) {
        throw new NotFoundError('Schedule not found');
      }

      res.json(schedule);
    } catch (error) {
      next(error);
    }
  }

  async createSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, name, description, metadata } = req.body;

      const schedule = await prisma.schedule.create({
        data: {
          projectId,
          name,
          description,
          metadata,
          status: 'draft',
          createdBy: req.user!.id,
        },
      });

      res.status(201).json(schedule);
    } catch (error) {
      next(error);
    }
  }

  async updateSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const { name, description, status, metadata } = req.body;

      const schedule = await prisma.schedule.update({
        where: { id: scheduleId },
        data: {
          name,
          description,
          status,
          metadata,
          updatedAt: new Date(),
        },
      });

      res.json(schedule);
    } catch (error) {
      next(error);
    }
  }

  async deleteSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;

      await prisma.schedule.delete({
        where: { id: scheduleId },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async getActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;

      const activities = await prisma.scheduleActivity.findMany({
        where: { scheduleId },
        orderBy: { startDate: 'asc' },
      });

      res.json(activities);
    } catch (error) {
      next(error);
    }
  }

  async getBaselines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;

      const baselines = await prisma.scheduleBaseline.findMany({
        where: { scheduleId },
        orderBy: { createdAt: 'desc' },
        take: 5, // Only keep 5 baselines
      });

      res.json(baselines);
    } catch (error) {
      next(error);
    }
  }

  async createBaseline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;

      // Get current activities
      const activities = await prisma.scheduleActivity.findMany({
        where: { scheduleId },
      });

      // Get current baseline count
      const baselineCount = await prisma.scheduleBaseline.count({
        where: { scheduleId },
      });

      // Create baseline
      const baseline = await prisma.scheduleBaseline.create({
        data: {
          scheduleId,
          version: baselineCount + 1,
          snapshotData: activities as unknown as object,
        },
      });

      // Delete oldest baselines if more than 5
      const oldBaselines = await prisma.scheduleBaseline.findMany({
        where: { scheduleId },
        orderBy: { createdAt: 'asc' },
        skip: 5,
      });

      if (oldBaselines.length > 0) {
        await prisma.scheduleBaseline.deleteMany({
          where: {
            id: { in: oldBaselines.map((b) => b.id) },
          },
        });
      }

      res.status(201).json(baseline);
    } catch (error) {
      next(error);
    }
  }

  async compareBaselines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const { baseline1, baseline2 } = req.query;

      const [b1, b2] = await Promise.all([
        prisma.scheduleBaseline.findFirst({
          where: { id: baseline1 as string, scheduleId },
        }),
        prisma.scheduleBaseline.findFirst({
          where: { id: baseline2 as string, scheduleId },
        }),
      ]);

      if (!b1 || !b2) {
        throw new NotFoundError('One or both baselines not found');
      }

      // TODO: Implement variance calculation
      res.json({
        baseline1: b1,
        baseline2: b2,
        variance: {
          message: 'Variance calculation to be implemented',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
