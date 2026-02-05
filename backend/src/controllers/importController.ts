import { Request, Response, NextFunction } from 'express';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import {
  importMappingService,
  ExternalActivity,
  ExternalRelationship,
  DiffApproval,
} from '../services/importMappingService.js';
import { xlsxImportService, XLSXImportOptions } from '../services/xlsxImportService.js';

interface XerTable {
  fields: string[];
  rows: Record<string, string>[];
}

const HOURS_PER_DAY = 8;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const parseXerTables = (content: string): Map<string, XerTable> => {
  const tables = new Map<string, XerTable>();
  let currentTable: XerTable | null = null;
  let currentTableName: string | null = null;

  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      continue;
    }

    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('%T')) {
      const [, tableName] = line.split('\t');
      if (!tableName) {
        continue;
      }
      currentTableName = tableName.trim();
      currentTable = { fields: [], rows: [] };
      tables.set(currentTableName, currentTable);
      continue;
    }

    if (line.startsWith('%F')) {
      if (!currentTable) {
        continue;
      }
      const parts = line.split('\t').slice(1);
      currentTable.fields = parts.map((field) => field.trim());
      continue;
    }

    if (line.startsWith('%R')) {
      if (!currentTable || !currentTableName) {
        continue;
      }
      const values = line.split('\t').slice(1);
      const row: Record<string, string> = {};
      currentTable.fields.forEach((field, index) => {
        row[field] = values[index] ?? '';
      });
      currentTable.rows.push(row);
    }
  }

  return tables;
};

const parseDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const parseNumber = (value?: string): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

const calculateDurationDays = (start: Date, finish: Date): number => {
  const diff = Math.round((finish.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(diff, 0);
};

const getDurationDays = (row: Record<string, string>, start: Date, finish: Date): number => {
  const durationDays = parseNumber(row.target_drtn) ?? parseNumber(row.act_drtn) ?? null;
  if (durationDays !== null) {
    return Math.max(Math.round(durationDays), 0);
  }

  const durationHours =
    parseNumber(row.target_drtn_hr_cnt) ??
    parseNumber(row.act_drtn_hr_cnt) ??
    parseNumber(row.remain_drtn_hr_cnt) ??
    null;

  if (durationHours !== null) {
    return Math.max(Math.round(durationHours / HOURS_PER_DAY), 0);
  }

  return calculateDurationDays(start, finish);
};

const buildExternalActivities = (tables: Map<string, XerTable>): ExternalActivity[] => {
  const taskTable = tables.get('TASK');
  if (!taskTable) {
    throw new BadRequestError('XER file missing TASK table');
  }

  return taskTable.rows.map((row) => {
    const externalId = row.task_id?.trim();
    if (!externalId) {
      throw new BadRequestError('XER TASK row missing task_id');
    }

    const startDate =
      parseDate(row.target_start_date) ??
      parseDate(row.act_start_date) ??
      parseDate(row.early_start_date) ??
      parseDate(row.start_date);

    const finishDate =
      parseDate(row.target_end_date) ??
      parseDate(row.act_end_date) ??
      parseDate(row.early_end_date) ??
      parseDate(row.finish_date);

    if (!startDate || !finishDate) {
      throw new BadRequestError(`XER TASK row ${externalId} missing start/finish dates`);
    }

    const duration = getDurationDays(row, startDate, finishDate);
    const percentComplete =
      parseNumber(row.phys_complete_pct) ??
      parseNumber(row.per_complete) ??
      parseNumber(row.percent_complete);

    const activity: ExternalActivity = {
      externalId,
      activityCode: row.task_code?.trim() || undefined,
      name: row.task_name?.trim() || row.task_code?.trim() || externalId,
      startDate,
      finishDate,
      duration,
      percentComplete: percentComplete !== null ? Math.round(percentComplete) : undefined,
      metadata: {
        xer: row,
      },
    };

    return activity;
  });
};

const buildExternalRelationships = (tables: Map<string, XerTable>): ExternalRelationship[] => {
  const predTable = tables.get('TASKPRED');
  if (!predTable) {
    return [];
  }

  return predTable.rows
    .map((row) => {
      const predecessorExternalId = row.pred_task_id?.trim();
      const successorExternalId = row.task_id?.trim();
      if (!predecessorExternalId || !successorExternalId) {
        return null;
      }

      const type = (row.pred_type?.trim() || 'FS') as ExternalRelationship['type'];
      const lagHours = parseNumber(row.lag_hr_cnt) ?? parseNumber(row.lag) ?? 0;

      return {
        predecessorExternalId,
        successorExternalId,
        type,
        lag: Math.round(lagHours / HOURS_PER_DAY),
      };
    })
    .filter((rel): rel is ExternalRelationship => rel !== null);
};

const parseDiffApproval = (value: unknown): DiffApproval | undefined => {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as DiffApproval;
    } catch {
      return undefined;
    }
  }
  return value as DiffApproval;
};

export class ImportController {
  async previewImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const { scheduleId } = req.body;
      if (!scheduleId) {
        throw new BadRequestError('scheduleId is required');
      }

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule) {
        throw new NotFoundError('Schedule not found');
      }

      const content = req.file.buffer.toString('utf8');
      const tables = parseXerTables(content);
      const externalActivities = buildExternalActivities(tables);

      const diff = await importMappingService.previewImportDiff(
        externalActivities,
        scheduleId,
        schedule.projectId
      );

      res.json({
        message: 'Import preview generated',
        fileName: req.file.originalname,
        fileSize: req.file.size,
        diff,
      });
    } catch (error) {
      next(error);
    }
  }

  async importXER(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const { scheduleId } = req.body;
      if (!scheduleId) {
        throw new BadRequestError('scheduleId is required');
      }

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule) {
        throw new NotFoundError('Schedule not found');
      }

      const content = req.file.buffer.toString('utf8');
      const tables = parseXerTables(content);
      const externalActivities = buildExternalActivities(tables);
      const externalRelationships = buildExternalRelationships(tables);
      const diffApproval = parseDiffApproval(req.body.diffApproval);

      const importResult = await importMappingService.mapActivitiesWithPersistentGUID(
        externalActivities,
        scheduleId,
        schedule.projectId,
        diffApproval
      );

      if (externalRelationships.length > 0) {
        await importMappingService.preserveRelationships(
          externalRelationships,
          schedule.projectId,
          scheduleId
        );
      }

      logger.info(
        `XER import completed for schedule ${scheduleId}: ${importResult.importedCount} new, ${importResult.updatedCount} updated`
      );

      res.json({
        message: 'XER import completed',
        fileName: req.file.originalname,
        scheduleId,
        result: importResult,
        relationshipsImported: externalRelationships.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async previewXLSX(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const options: XLSXImportOptions = {
        sheetName: req.body.sheetName,
        headerRow: req.body.headerRow ? parseInt(req.body.headerRow, 10) : undefined,
        columnMapping: req.body.columnMapping
          ? JSON.parse(req.body.columnMapping)
          : undefined,
      };

      const preview = await xlsxImportService.previewFile(req.file.buffer, options);

      res.json({
        message: 'XLSX preview generated',
        fileName: req.file.originalname,
        fileSize: req.file.size,
        ...preview,
      });
    } catch (error) {
      next(error);
    }
  }

  async previewXLSXImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const { scheduleId } = req.body;
      if (!scheduleId) {
        throw new BadRequestError('scheduleId is required');
      }

      const options: XLSXImportOptions = {
        sheetName: req.body.sheetName,
        headerRow: req.body.headerRow ? parseInt(req.body.headerRow, 10) : undefined,
        columnMapping: req.body.columnMapping
          ? JSON.parse(req.body.columnMapping)
          : undefined,
      };

      const preview = await xlsxImportService.previewImport(
        req.file.buffer,
        scheduleId,
        options
      );

      res.json({
        message: 'XLSX import preview generated',
        fileName: req.file.originalname,
        scheduleId,
        ...preview,
      });
    } catch (error) {
      next(error);
    }
  }

  async importXLSX(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const { scheduleId } = req.body;
      if (!scheduleId) {
        throw new BadRequestError('scheduleId is required');
      }

      const options: XLSXImportOptions = {
        sheetName: req.body.sheetName,
        headerRow: req.body.headerRow ? parseInt(req.body.headerRow, 10) : undefined,
        columnMapping: req.body.columnMapping
          ? JSON.parse(req.body.columnMapping)
          : undefined,
        skipEmptyRows: req.body.skipEmptyRows !== 'false',
        validateDates: req.body.validateDates !== 'false',
      };

      const diffApproval = req.body.diffApproval
        ? JSON.parse(req.body.diffApproval)
        : undefined;

      const result = await xlsxImportService.importFile(
        req.file.buffer,
        scheduleId,
        options,
        diffApproval
      );

      logger.info(
        `XLSX import completed for schedule ${scheduleId}: ${result.importedCount} new, ${result.updatedCount} updated, ${result.skippedCount} skipped`
      );

      res.json({
        message: result.success ? 'XLSX import completed' : 'XLSX import completed with errors',
        fileName: req.file.originalname,
        scheduleId,
        result,
      });
    } catch (error) {
      next(error);
    }
  }

  async importXML(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      // TODO: Implement XML import logic
      res.json({
        message: 'XML import - to be implemented',
        fileName: req.file.originalname,
      });
    } catch (error) {
      next(error);
    }
  }
}
