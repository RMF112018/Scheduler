import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class ActivityController {
  async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityId } = req.params;

      const activity = await prisma.scheduleActivity.findUnique({
        where: { id: activityId },
      });

      if (!activity) {
        throw new NotFoundError('Activity not found');
      }

      res.json(activity);
    } catch (error) {
      next(error);
    }
  }

  async createActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        scheduleId,
        name,
        activityCode,
        startDate,
        finishDate,
        duration,
        percentComplete,
        predecessorIds,
        successorIds,
        resourceIds,
        metadata,
      } = req.body;

      const activity = await prisma.scheduleActivity.create({
        data: {
          scheduleId,
          persistentInternalGuid: uuidv4(),
          name,
          activityCode,
          startDate: new Date(startDate),
          finishDate: new Date(finishDate),
          duration,
          percentComplete: percentComplete || 0,
          predecessorIds: predecessorIds || [],
          successorIds: successorIds || [],
          resourceIds: resourceIds || [],
          metadata,
        },
      });

      res.status(201).json(activity);
    } catch (error) {
      next(error);
    }
  }

  async updateActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityId } = req.params;
      const {
        name,
        activityCode,
        startDate,
        finishDate,
        duration,
        percentComplete,
        predecessorIds,
        successorIds,
        resourceIds,
        metadata,
      } = req.body;

      const activity = await prisma.scheduleActivity.update({
        where: { id: activityId },
        data: {
          name,
          activityCode,
          startDate: startDate ? new Date(startDate) : undefined,
          finishDate: finishDate ? new Date(finishDate) : undefined,
          duration,
          percentComplete,
          predecessorIds,
          successorIds,
          resourceIds,
          metadata,
          updatedAt: new Date(),
        },
      });

      res.json(activity);
    } catch (error) {
      next(error);
    }
  }

  async deleteActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityId } = req.params;

      await prisma.scheduleActivity.delete({
        where: { id: activityId },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async addRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { predecessorId, successorId, type } = req.body;

      // Update predecessor's successorIds
      await prisma.scheduleActivity.update({
        where: { id: predecessorId },
        data: {
          successorIds: {
            push: successorId,
          },
        },
      });

      // Update successor's predecessorIds
      await prisma.scheduleActivity.update({
        where: { id: successorId },
        data: {
          predecessorIds: {
            push: predecessorId,
          },
        },
      });

      res.json({ message: 'Relationship added', type });
    } catch (error) {
      next(error);
    }
  }

  async removeRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { predecessor, successor } = req.query;

      const predecessorActivity = await prisma.scheduleActivity.findUnique({
        where: { id: predecessor as string },
      });

      const successorActivity = await prisma.scheduleActivity.findUnique({
        where: { id: successor as string },
      });

      if (predecessorActivity && successorActivity) {
        // Remove from predecessor's successorIds
        await prisma.scheduleActivity.update({
          where: { id: predecessor as string },
          data: {
            successorIds: predecessorActivity.successorIds.filter(
              (id) => id !== successor
            ),
          },
        });

        // Remove from successor's predecessorIds
        await prisma.scheduleActivity.update({
          where: { id: successor as string },
          data: {
            predecessorIds: successorActivity.predecessorIds.filter(
              (id) => id !== predecessor
            ),
          },
        });
      }

      res.json({ message: 'Relationship removed' });
    } catch (error) {
      next(error);
    }
  }
}
