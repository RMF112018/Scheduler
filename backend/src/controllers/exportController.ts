/**
 * Export Controller
 *
 * Handles HTTP requests for schedule exports including:
 * - XLSX export with variance analysis
 * - PDF export with critical path summary
 * - XER export for Primavera P6
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { exportService, ExportOptions, PDFExportOptions } from '../services/exportService.js';

export class ExportController {
  /**
   * Export schedule to XLSX format
   */
  async exportXLSX(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const {
        includeBaseline,
        baselineId,
        includeVariance,
        includeCriticalPath,
        includeResourceAssignments,
      } = req.query;

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule) {
        throw new NotFoundError('Schedule not found');
      }

      const options: ExportOptions = {
        includeBaseline: includeBaseline === 'true',
        baselineId: baselineId as string | undefined,
        includeVariance: includeVariance === 'true',
        includeCriticalPath: includeCriticalPath === 'true',
        includeResourceAssignments: includeResourceAssignments === 'true',
      };

      const buffer = await exportService.exportToXLSX(scheduleId, options);

      const fileName = `${schedule.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export schedule to PDF format
   */
  async exportPDF(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const {
        includeBaseline,
        baselineId,
        includeVariance,
        includeCriticalPath,
        title,
        subtitle,
        pageSize,
        orientation,
      } = req.query;

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule) {
        throw new NotFoundError('Schedule not found');
      }

      const options: PDFExportOptions = {
        includeBaseline: includeBaseline === 'true',
        baselineId: baselineId as string | undefined,
        includeVariance: includeVariance === 'true',
        includeCriticalPath: includeCriticalPath === 'true',
        title: (title as string) || schedule.name,
        subtitle: subtitle as string | undefined,
        pageSize: (pageSize as 'A4' | 'LETTER' | 'LEGAL') || 'A4',
        orientation: (orientation as 'portrait' | 'landscape') || 'landscape',
        includeHeader: true,
        includeFooter: true,
      };

      const buffer = await exportService.exportToPDF(scheduleId, options);

      const fileName = `${schedule.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export schedule to XER format (Primavera P6)
   */
  async exportXER(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: { activities: true },
      });

      if (!schedule) {
        throw new NotFoundError('Schedule not found');
      }

      // Generate XER content
      const xerContent = this.generateXERContent(schedule);

      const fileName = `${schedule.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xer`;

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(xerContent);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export schedule to XML format (MS Project compatible)
   */
  async exportXML(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: { activities: true },
      });

      if (!schedule) {
        throw new NotFoundError('Schedule not found');
      }

      // Generate XML content
      const xmlContent = this.generateXMLContent(schedule);

      const fileName = `${schedule.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xml`;

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(xmlContent);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private generateXERContent(
    schedule: { name: string; activities: Array<{
      id: string;
      activityCode: string | null;
      name: string;
      startDate: Date;
      finishDate: Date;
      duration: number;
      percentComplete: number;
      predecessorIds: string[];
      totalFloat: number | null;
    }> }
  ): string {
    const lines: string[] = [];

    // Header
    lines.push('ERMHDR\t19.12\t2024-01-01\tProject Export\tUSD');
    lines.push('');

    // Project table
    lines.push('%T\tPROJECT');
    lines.push('%F\tproj_id\tproj_short_name');
    lines.push(`%R\t1\t${schedule.name}`);
    lines.push('');

    // Task table
    lines.push('%T\tTASK');
    lines.push(
      '%F\ttask_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn\tphys_complete_pct\ttotal_float_hr_cnt'
    );

    schedule.activities.forEach((activity, index) => {
      const startDate = new Date(activity.startDate).toISOString().split('T')[0];
      const endDate = new Date(activity.finishDate).toISOString().split('T')[0];
      lines.push(
        `%R\t${index + 1}\t${activity.activityCode || activity.id}\t${activity.name}\t${startDate}\t${endDate}\t${activity.duration}\t${activity.percentComplete}\t${(activity.totalFloat || 0) * 8}`
      );
    });

    lines.push('');

    // Predecessor table
    lines.push('%T\tTASKPRED');
    lines.push('%F\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt');

    const activityIndexMap = new Map<string, number>();
    schedule.activities.forEach((activity, index) => {
      activityIndexMap.set(activity.id, index + 1);
    });

    schedule.activities.forEach((activity, index) => {
      if (activity.predecessorIds && activity.predecessorIds.length > 0) {
        activity.predecessorIds.forEach((predId) => {
          const predIndex = activityIndexMap.get(predId);
          if (predIndex) {
            lines.push(`%R\t${index + 1}\t${predIndex}\tFS\t0`);
          }
        });
      }
    });

    lines.push('');
    lines.push('%E');

    return lines.join('\r\n');
  }

  private generateXMLContent(
    schedule: { name: string; activities: Array<{
      id: string;
      activityCode: string | null;
      name: string;
      startDate: Date;
      finishDate: Date;
      duration: number;
      percentComplete: number;
      predecessorIds: string[];
    }> }
  ): string {
    const escapeXml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<Project xmlns="http://schemas.microsoft.com/project">');
    lines.push(`  <Name>${escapeXml(schedule.name)}</Name>`);
    lines.push('  <Tasks>');

    schedule.activities.forEach((activity, index) => {
      const startDate = new Date(activity.startDate).toISOString();
      const finishDate = new Date(activity.finishDate).toISOString();

      lines.push('    <Task>');
      lines.push(`      <UID>${index + 1}</UID>`);
      lines.push(`      <ID>${index + 1}</ID>`);
      lines.push(`      <Name>${escapeXml(activity.name)}</Name>`);
      lines.push(`      <Start>${startDate}</Start>`);
      lines.push(`      <Finish>${finishDate}</Finish>`);
      lines.push(`      <Duration>PT${activity.duration * 8}H0M0S</Duration>`);
      lines.push(`      <PercentComplete>${activity.percentComplete}</PercentComplete>`);

      if (activity.predecessorIds && activity.predecessorIds.length > 0) {
        activity.predecessorIds.forEach((predId) => {
          const predIndex = schedule.activities.findIndex((a) => a.id === predId);
          if (predIndex >= 0) {
            lines.push('      <PredecessorLink>');
            lines.push(`        <PredecessorUID>${predIndex + 1}</PredecessorUID>`);
            lines.push('        <Type>1</Type>');
            lines.push('      </PredecessorLink>');
          }
        });
      }

      lines.push('    </Task>');
    });

    lines.push('  </Tasks>');
    lines.push('</Project>');

    return lines.join('\n');
  }
}
