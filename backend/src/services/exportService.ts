/**
 * Export Service
 *
 * Provides comprehensive export functionality for schedules including:
 * - XLSX export with formatting and multiple sheets
 * - PDF export with variance view and critical path summary
 * - XER export for Primavera P6 compatibility
 */

import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { PrismaClient, ScheduleActivity, Schedule, ScheduleBaseline } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export interface ExportOptions {
  includeBaseline?: boolean;
  baselineId?: string;
  includeVariance?: boolean;
  includeCriticalPath?: boolean;
  includeResourceAssignments?: boolean;
  dateFormat?: string;
}

export interface ScheduleExportData {
  schedule: Schedule;
  activities: ScheduleActivity[];
  baseline?: ScheduleBaseline & { activities: unknown[] };
  criticalPath?: string[];
  variance?: VarianceData[];
}

export interface VarianceData {
  activityId: string;
  activityCode: string;
  activityName: string;
  baselineStart: Date | null;
  baselineFinish: Date | null;
  currentStart: Date;
  currentFinish: Date;
  startVariance: number; // days
  finishVariance: number; // days
  durationVariance: number; // days
  isCritical: boolean;
}

export interface PDFExportOptions extends ExportOptions {
  title?: string;
  subtitle?: string;
  includeHeader?: boolean;
  includeFooter?: boolean;
  pageSize?: 'A4' | 'LETTER' | 'LEGAL';
  orientation?: 'portrait' | 'landscape';
}

// ============================================================================
// Export Service Class
// ============================================================================

export class ExportService {
  // ==========================================================================
  // XLSX Export
  // ==========================================================================

  /**
   * Export schedule to XLSX format
   */
  async exportToXLSX(
    scheduleId: string,
    options: ExportOptions = {}
  ): Promise<Buffer> {
    const data = await this.getScheduleExportData(scheduleId, options);
    const workbook = XLSX.utils.book_new();

    // Activities Sheet
    const activitiesSheet = this.createActivitiesSheet(data.activities);
    XLSX.utils.book_append_sheet(workbook, activitiesSheet, 'Activities');

    // Variance Sheet (if baseline comparison requested)
    if (options.includeVariance && data.variance) {
      const varianceSheet = this.createVarianceSheet(data.variance);
      XLSX.utils.book_append_sheet(workbook, varianceSheet, 'Variance Analysis');
    }

    // Critical Path Sheet
    if (options.includeCriticalPath) {
      const criticalActivities = data.activities.filter((a) => a.isCritical);
      const criticalSheet = this.createActivitiesSheet(criticalActivities);
      XLSX.utils.book_append_sheet(workbook, criticalSheet, 'Critical Path');
    }

    // Summary Sheet
    const summarySheet = this.createSummarySheet(data);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  private createActivitiesSheet(activities: ScheduleActivity[]): XLSX.WorkSheet {
    const headers = [
      'Activity Code',
      'Activity Name',
      'Start Date',
      'Finish Date',
      'Duration (days)',
      'Progress (%)',
      'Total Float',
      'Is Critical',
      'Predecessors',
      'Successors',
      'WBS',
      'Status',
    ];

    const rows = activities.map((activity) => [
      activity.activityCode,
      activity.name,
      this.formatDate(activity.startDate),
      this.formatDate(activity.finishDate),
      activity.duration,
      activity.percentComplete,
      activity.totalFloat ?? 0,
      activity.isCritical ? 'Yes' : 'No',
      (activity.predecessorIds || []).join(', '),
      (activity.successorIds || []).join(', '),
      activity.wbs || '',
      this.getActivityStatus(activity),
    ]);

    const data = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    sheet['!cols'] = [
      { wch: 15 }, // Activity Code
      { wch: 40 }, // Activity Name
      { wch: 12 }, // Start Date
      { wch: 12 }, // Finish Date
      { wch: 12 }, // Duration
      { wch: 10 }, // Progress
      { wch: 10 }, // Total Float
      { wch: 10 }, // Is Critical
      { wch: 20 }, // Predecessors
      { wch: 20 }, // Successors
      { wch: 20 }, // WBS
      { wch: 12 }, // Status
    ];

    return sheet;
  }

  private createVarianceSheet(variance: VarianceData[]): XLSX.WorkSheet {
    const headers = [
      'Activity Code',
      'Activity Name',
      'Baseline Start',
      'Current Start',
      'Start Variance (days)',
      'Baseline Finish',
      'Current Finish',
      'Finish Variance (days)',
      'Duration Variance (days)',
      'Is Critical',
      'Status',
    ];

    const rows = variance.map((v) => [
      v.activityCode,
      v.activityName,
      v.baselineStart ? this.formatDate(v.baselineStart) : 'N/A',
      this.formatDate(v.currentStart),
      v.startVariance,
      v.baselineFinish ? this.formatDate(v.baselineFinish) : 'N/A',
      this.formatDate(v.currentFinish),
      v.finishVariance,
      v.durationVariance,
      v.isCritical ? 'Yes' : 'No',
      this.getVarianceStatus(v),
    ]);

    const data = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(data);

    sheet['!cols'] = [
      { wch: 15 },
      { wch: 40 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
    ];

    return sheet;
  }

  private createSummarySheet(data: ScheduleExportData): XLSX.WorkSheet {
    const totalActivities = data.activities.length;
    const completedActivities = data.activities.filter(
      (a) => a.percentComplete === 100
    ).length;
    const criticalActivities = data.activities.filter((a) => a.isCritical).length;
    const delayedActivities = data.variance?.filter((v) => v.finishVariance > 0).length || 0;

    const summaryData = [
      ['Schedule Summary'],
      [],
      ['Schedule Name', data.schedule.name],
      ['Schedule Status', data.schedule.status],
      ['Data Date', this.formatDate(data.schedule.dataDate || new Date())],
      [],
      ['Activity Statistics'],
      ['Total Activities', totalActivities],
      ['Completed Activities', completedActivities],
      ['In Progress', totalActivities - completedActivities],
      ['Critical Path Activities', criticalActivities],
      ['Overall Progress', `${Math.round((completedActivities / totalActivities) * 100)}%`],
      [],
      ['Variance Statistics'],
      ['Activities with Delay', delayedActivities],
      ['On Schedule', totalActivities - delayedActivities],
    ];

    const sheet = XLSX.utils.aoa_to_sheet(summaryData);
    sheet['!cols'] = [{ wch: 25 }, { wch: 30 }];

    return sheet;
  }

  // ==========================================================================
  // PDF Export
  // ==========================================================================

  /**
   * Export schedule to PDF format with variance view
   */
  async exportToPDF(
    scheduleId: string,
    options: PDFExportOptions = {}
  ): Promise<Buffer> {
    const data = await this.getScheduleExportData(scheduleId, options);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: options.pageSize || 'A4',
        layout: options.orientation || 'landscape',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title Page
      this.addPDFTitlePage(doc, data, options);

      // Summary Section
      doc.addPage();
      this.addPDFSummary(doc, data);

      // Critical Path Section
      if (options.includeCriticalPath) {
        doc.addPage();
        this.addPDFCriticalPath(doc, data);
      }

      // Variance Analysis Section
      if (options.includeVariance && data.variance) {
        doc.addPage();
        this.addPDFVarianceAnalysis(doc, data.variance);
      }

      // Activities List
      doc.addPage();
      this.addPDFActivitiesList(doc, data.activities);

      doc.end();
    });
  }

  private addPDFTitlePage(
    doc: PDFKit.PDFDocument,
    data: ScheduleExportData,
    options: PDFExportOptions
  ): void {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Title
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .text(options.title || data.schedule.name, 50, pageHeight / 3, {
        width: pageWidth - 100,
        align: 'center',
      });

    // Subtitle
    if (options.subtitle) {
      doc
        .fontSize(16)
        .font('Helvetica')
        .text(options.subtitle, 50, pageHeight / 3 + 50, {
          width: pageWidth - 100,
          align: 'center',
        });
    }

    // Report Info
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Generated: ${this.formatDate(new Date())}`, 50, pageHeight / 2 + 50, {
        width: pageWidth - 100,
        align: 'center',
      })
      .text(`Data Date: ${this.formatDate(data.schedule.dataDate || new Date())}`, {
        width: pageWidth - 100,
        align: 'center',
      })
      .text(`Total Activities: ${data.activities.length}`, {
        width: pageWidth - 100,
        align: 'center',
      });
  }

  private addPDFSummary(doc: PDFKit.PDFDocument, data: ScheduleExportData): void {
    const totalActivities = data.activities.length;
    const completedActivities = data.activities.filter(
      (a) => a.percentComplete === 100
    ).length;
    const criticalActivities = data.activities.filter((a) => a.isCritical).length;
    const progress = Math.round((completedActivities / totalActivities) * 100);

    doc.fontSize(20).font('Helvetica-Bold').text('Schedule Summary', 50, 50);

    doc.fontSize(12).font('Helvetica').moveDown();

    // Summary table
    const summaryItems = [
      ['Schedule Name:', data.schedule.name],
      ['Status:', data.schedule.status],
      ['Total Activities:', totalActivities.toString()],
      ['Completed:', completedActivities.toString()],
      ['In Progress:', (totalActivities - completedActivities).toString()],
      ['Critical Path Activities:', criticalActivities.toString()],
      ['Overall Progress:', `${progress}%`],
    ];

    let y = 100;
    summaryItems.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(label, 50, y);
      doc.font('Helvetica').text(value, 200, y);
      y += 25;
    });

    // Progress bar
    y += 20;
    doc.font('Helvetica-Bold').text('Progress:', 50, y);
    const barWidth = 300;
    const barHeight = 20;
    const barX = 200;

    // Background
    doc.rect(barX, y, barWidth, barHeight).fill('#e0e0e0');

    // Progress fill
    doc.rect(barX, y, barWidth * (progress / 100), barHeight).fill('#4caf50');

    // Border
    doc.rect(barX, y, barWidth, barHeight).stroke('#333');

    // Percentage text
    doc
      .fillColor('#000')
      .font('Helvetica-Bold')
      .text(`${progress}%`, barX + barWidth + 10, y + 3);
  }

  private addPDFCriticalPath(doc: PDFKit.PDFDocument, data: ScheduleExportData): void {
    doc.fontSize(20).font('Helvetica-Bold').text('Critical Path Activities', 50, 50);

    const criticalActivities = data.activities
      .filter((a) => a.isCritical)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    if (criticalActivities.length === 0) {
      doc.fontSize(12).font('Helvetica').text('No critical path activities found.', 50, 100);
      return;
    }

    // Table headers
    const headers = ['Code', 'Name', 'Start', 'Finish', 'Duration', 'Float'];
    const colWidths = [80, 200, 80, 80, 60, 60];
    let y = 100;

    // Header row
    doc.fontSize(10).font('Helvetica-Bold');
    let x = 50;
    headers.forEach((header, i) => {
      doc.text(header, x, y, { width: colWidths[i] });
      x += colWidths[i];
    });

    // Draw header line
    y += 15;
    doc.moveTo(50, y).lineTo(610, y).stroke();
    y += 10;

    // Data rows
    doc.font('Helvetica');
    criticalActivities.slice(0, 25).forEach((activity) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      x = 50;
      const row = [
        activity.activityCode || '',
        activity.name.substring(0, 35),
        this.formatDate(activity.startDate),
        this.formatDate(activity.finishDate),
        activity.duration.toString(),
        (activity.totalFloat ?? 0).toString(),
      ];

      row.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 20;
    });

    if (criticalActivities.length > 25) {
      doc.text(`... and ${criticalActivities.length - 25} more activities`, 50, y + 10);
    }
  }

  private addPDFVarianceAnalysis(
    doc: PDFKit.PDFDocument,
    variance: VarianceData[]
  ): void {
    doc.fontSize(20).font('Helvetica-Bold').text('Variance Analysis', 50, 50);

    // Filter to show only activities with variance
    const activitiesWithVariance = variance.filter(
      (v) => v.startVariance !== 0 || v.finishVariance !== 0
    );

    if (activitiesWithVariance.length === 0) {
      doc.fontSize(12).font('Helvetica').text('No variance detected.', 50, 100);
      return;
    }

    // Summary stats
    const delayed = activitiesWithVariance.filter((v) => v.finishVariance > 0).length;
    const ahead = activitiesWithVariance.filter((v) => v.finishVariance < 0).length;
    const avgDelay =
      activitiesWithVariance.reduce((sum, v) => sum + v.finishVariance, 0) /
      activitiesWithVariance.length;

    doc.fontSize(12).font('Helvetica');
    doc.text(`Activities with Variance: ${activitiesWithVariance.length}`, 50, 90);
    doc.text(`Delayed: ${delayed}`, 50, 110);
    doc.text(`Ahead of Schedule: ${ahead}`, 50, 130);
    doc.text(`Average Variance: ${avgDelay.toFixed(1)} days`, 50, 150);

    // Table
    const headers = ['Code', 'Name', 'Start Var', 'Finish Var', 'Critical', 'Status'];
    const colWidths = [80, 200, 70, 70, 60, 80];
    let y = 190;

    // Header row
    doc.fontSize(10).font('Helvetica-Bold');
    let x = 50;
    headers.forEach((header, i) => {
      doc.text(header, x, y, { width: colWidths[i] });
      x += colWidths[i];
    });

    y += 15;
    doc.moveTo(50, y).lineTo(610, y).stroke();
    y += 10;

    // Data rows
    doc.font('Helvetica');
    activitiesWithVariance.slice(0, 20).forEach((v) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      x = 50;
      const row = [
        v.activityCode,
        v.activityName.substring(0, 35),
        `${v.startVariance > 0 ? '+' : ''}${v.startVariance}d`,
        `${v.finishVariance > 0 ? '+' : ''}${v.finishVariance}d`,
        v.isCritical ? 'Yes' : 'No',
        this.getVarianceStatus(v),
      ];

      row.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 20;
    });
  }

  private addPDFActivitiesList(
    doc: PDFKit.PDFDocument,
    activities: ScheduleActivity[]
  ): void {
    doc.fontSize(20).font('Helvetica-Bold').text('Activities List', 50, 50);

    const headers = ['Code', 'Name', 'Start', 'Finish', 'Progress', 'Critical'];
    const colWidths = [80, 220, 80, 80, 60, 60];
    let y = 90;

    // Header row
    doc.fontSize(10).font('Helvetica-Bold');
    let x = 50;
    headers.forEach((header, i) => {
      doc.text(header, x, y, { width: colWidths[i] });
      x += colWidths[i];
    });

    y += 15;
    doc.moveTo(50, y).lineTo(630, y).stroke();
    y += 10;

    // Data rows
    doc.font('Helvetica');
    activities.forEach((activity) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;

        // Repeat headers on new page
        doc.fontSize(10).font('Helvetica-Bold');
        x = 50;
        headers.forEach((header, i) => {
          doc.text(header, x, y, { width: colWidths[i] });
          x += colWidths[i];
        });
        y += 15;
        doc.moveTo(50, y).lineTo(630, y).stroke();
        y += 10;
        doc.font('Helvetica');
      }

      x = 50;
      const row = [
        activity.activityCode || '',
        activity.name.substring(0, 40),
        this.formatDate(activity.startDate),
        this.formatDate(activity.finishDate),
        `${activity.percentComplete}%`,
        activity.isCritical ? 'Yes' : 'No',
      ];

      row.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 18;
    });
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private async getScheduleExportData(
    scheduleId: string,
    options: ExportOptions
  ): Promise<ScheduleExportData> {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        activities: {
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const data: ScheduleExportData = {
      schedule,
      activities: schedule.activities,
    };

    // Get baseline for variance calculation
    if (options.includeVariance || options.includeBaseline) {
      const baseline = options.baselineId
        ? await prisma.scheduleBaseline.findUnique({
            where: { id: options.baselineId },
          })
        : await prisma.scheduleBaseline.findFirst({
            where: { scheduleId },
            orderBy: { version: 'desc' },
          });

      if (baseline) {
        data.baseline = baseline as ScheduleBaseline & { activities: unknown[] };
        data.variance = this.calculateVariance(schedule.activities, baseline);
      }
    }

    // Get critical path
    if (options.includeCriticalPath) {
      data.criticalPath = schedule.activities
        .filter((a) => a.isCritical)
        .map((a) => a.id);
    }

    return data;
  }

  private calculateVariance(
    activities: ScheduleActivity[],
    baseline: ScheduleBaseline
  ): VarianceData[] {
    // Get activities from snapshotData
    const snapshotData = baseline.snapshotData as Record<string, unknown> | null;
    const baselineActivities = (snapshotData?.activities as unknown[]) || [];
    const baselineMap = new Map<string, Record<string, unknown>>();

    // Build map of baseline activities by persistentInternalGuid
    baselineActivities.forEach((ba: unknown) => {
      const activity = ba as Record<string, unknown>;
      const guid = activity.persistentInternalGuid as string;
      if (guid) {
        baselineMap.set(guid, activity);
      }
    });

    return activities.map((activity) => {
      const baselineActivity = baselineMap.get(activity.persistentInternalGuid);

      const baselineStart = baselineActivity
        ? new Date(baselineActivity.startDate as string)
        : null;
      const baselineFinish = baselineActivity
        ? new Date(baselineActivity.finishDate as string)
        : null;
      const baselineDuration = baselineActivity
        ? (baselineActivity.duration as number)
        : null;

      const currentStart = new Date(activity.startDate);
      const currentFinish = new Date(activity.finishDate);

      const startVariance = baselineStart
        ? Math.round(
            (currentStart.getTime() - baselineStart.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0;

      const finishVariance = baselineFinish
        ? Math.round(
            (currentFinish.getTime() - baselineFinish.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0;

      const durationVariance = baselineDuration
        ? activity.duration - baselineDuration
        : 0;

      return {
        activityId: activity.id,
        activityCode: activity.activityCode || '',
        activityName: activity.name,
        baselineStart,
        baselineFinish,
        currentStart,
        currentFinish,
        startVariance,
        finishVariance,
        durationVariance,
        isCritical: activity.isCritical,
      };
    });
  }

  private formatDate(date: Date | string | null): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }

  private getActivityStatus(activity: ScheduleActivity): string {
    if (activity.percentComplete === 100) return 'Complete';
    if (activity.percentComplete > 0) return 'In Progress';
    if (new Date(activity.startDate) <= new Date()) return 'Started';
    return 'Not Started';
  }

  private getVarianceStatus(variance: VarianceData): string {
    if (variance.finishVariance > 5) return 'Delayed';
    if (variance.finishVariance > 0) return 'Slightly Delayed';
    if (variance.finishVariance < -5) return 'Ahead';
    if (variance.finishVariance < 0) return 'Slightly Ahead';
    return 'On Schedule';
  }
}

// Singleton instance
export const exportService = new ExportService();

export default exportService;
