/**
 * XLSX Import Service
 *
 * Provides comprehensive XLSX import functionality including:
 * - Column mapping with auto-detection
 * - Data validation and transformation
 * - Preview with diff generation
 * - Integration with ImportMappingService for GUID preservation
 */

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import {
  importMappingService,
  ExternalActivity,
  ExternalRelationship,
  DiffApproval,
} from '../modules/core/services/importMappingService.js';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export interface ColumnMapping {
  externalId: string;
  activityCode?: string;
  name: string;
  startDate: string;
  finishDate: string;
  duration?: string;
  percentComplete?: string;
  predecessors?: string;
  successors?: string;
  wbs?: string;
  resources?: string;
  notes?: string;
}

export interface XLSXImportOptions {
  sheetName?: string;
  headerRow?: number;
  columnMapping?: Partial<ColumnMapping>;
  dateFormat?: string;
  skipEmptyRows?: boolean;
  validateDates?: boolean;
}

export interface XLSXPreviewResult {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  totalRows: number;
  detectedColumns: string[];
  suggestedMapping: Partial<ColumnMapping>;
  sampleData: Record<string, unknown>[];
  validationErrors: ValidationError[];
}

export interface ValidationError {
  row: number;
  column: string;
  value: unknown;
  message: string;
  severity: 'error' | 'warning';
}

export interface XLSXImportResult {
  success: boolean;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// Column Detection Patterns
// ============================================================================

const COLUMN_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  externalId: [/^id$/i, /task.?id/i, /activity.?id/i, /^code$/i, /external.?id/i],
  activityCode: [/activity.?code/i, /task.?code/i, /^code$/i, /wbs.?code/i],
  name: [/^name$/i, /activity.?name/i, /task.?name/i, /description/i, /title/i],
  startDate: [/start/i, /begin/i, /^from$/i, /planned.?start/i, /target.?start/i],
  finishDate: [/finish/i, /end/i, /^to$/i, /complete/i, /planned.?finish/i, /target.?end/i],
  duration: [/duration/i, /^days$/i, /length/i],
  percentComplete: [/percent/i, /progress/i, /complete/i, /^%$/i, /pct/i],
  predecessors: [/predecessor/i, /depends/i, /^pred$/i, /before/i],
  successors: [/successor/i, /^succ$/i, /after/i, /follows/i],
  wbs: [/^wbs$/i, /work.?breakdown/i, /structure/i, /hierarchy/i],
  resources: [/resource/i, /assigned/i, /team/i, /staff/i],
  notes: [/note/i, /comment/i, /remark/i, /description/i],
};

// ============================================================================
// XLSX Import Service Class
// ============================================================================

export class XLSXImportService {
  /**
   * Preview XLSX file and detect column mappings
   */
  async previewFile(
    buffer: Buffer,
    options: XLSXImportOptions = {}
  ): Promise<XLSXPreviewResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      throw new Error('XLSX file contains no sheets');
    }

    const selectedSheet = options.sheetName || sheetNames[0];
    const sheet = workbook.Sheets[selectedSheet];

    if (!sheet) {
      throw new Error(`Sheet "${selectedSheet}" not found`);
    }

    const headerRow = options.headerRow || 1;
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][];

    if (data.length < headerRow) {
      throw new Error('File does not contain enough rows for headers');
    }

    const headers = (data[headerRow - 1] as unknown[]).map((h) =>
      String(h || '').trim()
    );
    const detectedColumns = headers.filter((h) => h.length > 0);

    // Auto-detect column mapping
    const suggestedMapping = this.detectColumnMapping(detectedColumns);

    // Get sample data (first 5 data rows)
    const sampleData: Record<string, unknown>[] = [];
    for (let i = headerRow; i < Math.min(data.length, headerRow + 5); i++) {
      const row = data[i] as unknown[];
      const rowData: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header) {
          rowData[header] = row[index];
        }
      });
      sampleData.push(rowData);
    }

    // Validate sample data
    const validationErrors = this.validateSampleData(
      sampleData,
      suggestedMapping,
      options
    );

    return {
      fileName: 'uploaded.xlsx',
      sheetNames,
      selectedSheet,
      totalRows: data.length - headerRow,
      detectedColumns,
      suggestedMapping,
      sampleData,
      validationErrors,
    };
  }

  /**
   * Import XLSX file into schedule
   */
  async importFile(
    buffer: Buffer,
    scheduleId: string,
    options: XLSXImportOptions = {},
    diffApproval?: DiffApproval
  ): Promise<XLSXImportResult> {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const selectedSheet = options.sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[selectedSheet];

    if (!sheet) {
      throw new Error(`Sheet "${selectedSheet}" not found`);
    }

    const headerRow = options.headerRow || 1;
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][];

    const headers = (data[headerRow - 1] as unknown[]).map((h) =>
      String(h || '').trim()
    );

    // Get or detect column mapping
    const mapping = options.columnMapping
      ? this.mergeMapping(this.detectColumnMapping(headers), options.columnMapping)
      : this.detectColumnMapping(headers);

    // Validate required columns
    this.validateRequiredColumns(mapping);

    // Parse activities
    const { activities, relationships, errors, warnings } = this.parseActivities(
      data.slice(headerRow),
      headers,
      mapping,
      options
    );

    if (errors.length > 0 && !diffApproval) {
      return {
        success: false,
        importedCount: 0,
        updatedCount: 0,
        skippedCount: errors.length,
        errors,
        warnings,
      };
    }

    // Import using ImportMappingService
    const importResult = await importMappingService.mapActivitiesWithPersistentGUID(
      activities,
      scheduleId,
      schedule.projectId,
      diffApproval
    );

    // Import relationships if present
    if (relationships.length > 0) {
      await importMappingService.preserveRelationships(
        relationships,
        schedule.projectId,
        scheduleId
      );
    }

    return {
      success: true,
      importedCount: importResult.importedCount,
      updatedCount: importResult.updatedCount,
      skippedCount: errors.length,
      errors,
      warnings,
    };
  }

  /**
   * Generate import diff preview
   */
  async previewImport(
    buffer: Buffer,
    scheduleId: string,
    options: XLSXImportOptions = {}
  ) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const selectedSheet = options.sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[selectedSheet];

    if (!sheet) {
      throw new Error(`Sheet "${selectedSheet}" not found`);
    }

    const headerRow = options.headerRow || 1;
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][];

    const headers = (data[headerRow - 1] as unknown[]).map((h) =>
      String(h || '').trim()
    );

    const mapping = options.columnMapping
      ? this.mergeMapping(this.detectColumnMapping(headers), options.columnMapping)
      : this.detectColumnMapping(headers);

    const { activities, errors, warnings } = this.parseActivities(
      data.slice(headerRow),
      headers,
      mapping,
      options
    );

    // Generate diff using ImportMappingService
    const diff = await importMappingService.previewImportDiff(
      activities,
      scheduleId,
      schedule.projectId
    );

    return {
      diff,
      validationErrors: errors,
      validationWarnings: warnings,
      totalActivities: activities.length,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private detectColumnMapping(columns: string[]): Partial<ColumnMapping> {
    const mapping: Partial<ColumnMapping> = {};

    for (const column of columns) {
      for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        if (patterns.some((pattern) => pattern.test(column))) {
          if (!mapping[field as keyof ColumnMapping]) {
            mapping[field as keyof ColumnMapping] = column;
          }
          break;
        }
      }
    }

    return mapping;
  }

  private mergeMapping(
    detected: Partial<ColumnMapping>,
    provided: Partial<ColumnMapping>
  ): Partial<ColumnMapping> {
    return { ...detected, ...provided };
  }

  private validateRequiredColumns(mapping: Partial<ColumnMapping>): void {
    const required: (keyof ColumnMapping)[] = ['name', 'startDate', 'finishDate'];
    const missing = required.filter((field) => !mapping[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required column mappings: ${missing.join(', ')}`);
    }
  }

  private validateSampleData(
    sampleData: Record<string, unknown>[],
    mapping: Partial<ColumnMapping>,
    options: XLSXImportOptions
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    sampleData.forEach((row, index) => {
      // Validate dates
      if (mapping.startDate) {
        const startValue = row[mapping.startDate];
        if (!this.isValidDate(startValue)) {
          errors.push({
            row: index + 1,
            column: mapping.startDate,
            value: startValue,
            message: 'Invalid start date format',
            severity: 'error',
          });
        }
      }

      if (mapping.finishDate) {
        const finishValue = row[mapping.finishDate];
        if (!this.isValidDate(finishValue)) {
          errors.push({
            row: index + 1,
            column: mapping.finishDate,
            value: finishValue,
            message: 'Invalid finish date format',
            severity: 'error',
          });
        }
      }

      // Validate name
      if (mapping.name) {
        const nameValue = row[mapping.name];
        if (!nameValue || String(nameValue).trim().length === 0) {
          errors.push({
            row: index + 1,
            column: mapping.name,
            value: nameValue,
            message: 'Activity name is required',
            severity: 'error',
          });
        }
      }

      // Validate percent complete
      if (mapping.percentComplete) {
        const pctValue = row[mapping.percentComplete];
        if (pctValue !== undefined && pctValue !== '') {
          const pct = this.parsePercentage(pctValue);
          if (pct === null || pct < 0 || pct > 100) {
            errors.push({
              row: index + 1,
              column: mapping.percentComplete,
              value: pctValue,
              message: 'Percent complete must be between 0 and 100',
              severity: 'warning',
            });
          }
        }
      }
    });

    return errors;
  }

  private parseActivities(
    rows: unknown[][],
    headers: string[],
    mapping: Partial<ColumnMapping>,
    options: XLSXImportOptions
  ): {
    activities: ExternalActivity[];
    relationships: ExternalRelationship[];
    errors: ValidationError[];
    warnings: ValidationError[];
  } {
    const activities: ExternalActivity[] = [];
    const relationships: ExternalRelationship[] = [];
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    const getColumnIndex = (columnName?: string): number => {
      if (!columnName) return -1;
      return headers.indexOf(columnName);
    };

    const getValue = (row: unknown[], columnName?: string): unknown => {
      const index = getColumnIndex(columnName);
      return index >= 0 ? row[index] : undefined;
    };

    rows.forEach((row, rowIndex) => {
      const actualRow = rowIndex + 2; // Account for header row and 0-indexing

      // Skip empty rows
      if (options.skipEmptyRows !== false) {
        const hasData = row.some((cell) => cell !== undefined && cell !== '');
        if (!hasData) return;
      }

      try {
        const name = String(getValue(row, mapping.name) || '').trim();
        if (!name) {
          if (options.skipEmptyRows !== false) return;
          errors.push({
            row: actualRow,
            column: mapping.name || 'name',
            value: '',
            message: 'Activity name is required',
            severity: 'error',
          });
          return;
        }

        const startDateValue = getValue(row, mapping.startDate);
        const finishDateValue = getValue(row, mapping.finishDate);

        const startDate = this.parseDate(startDateValue);
        const finishDate = this.parseDate(finishDateValue);

        if (!startDate) {
          errors.push({
            row: actualRow,
            column: mapping.startDate || 'startDate',
            value: startDateValue,
            message: 'Invalid or missing start date',
            severity: 'error',
          });
          return;
        }

        if (!finishDate) {
          errors.push({
            row: actualRow,
            column: mapping.finishDate || 'finishDate',
            value: finishDateValue,
            message: 'Invalid or missing finish date',
            severity: 'error',
          });
          return;
        }

        // Validate date order
        if (finishDate < startDate) {
          errors.push({
            row: actualRow,
            column: mapping.finishDate || 'finishDate',
            value: finishDateValue,
            message: 'Finish date cannot be before start date',
            severity: 'error',
          });
          return;
        }

        // Calculate duration
        const durationValue = getValue(row, mapping.duration);
        const duration = durationValue
          ? this.parseDuration(durationValue)
          : Math.ceil(
              (finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            );

        // Parse percent complete
        const pctValue = getValue(row, mapping.percentComplete);
        const percentComplete = pctValue ? this.parsePercentage(pctValue) : undefined;

        // Generate external ID
        const externalIdValue = getValue(row, mapping.externalId);
        const externalId = externalIdValue
          ? String(externalIdValue).trim()
          : `row-${actualRow}`;

        const activity: ExternalActivity = {
          externalId,
          activityCode: mapping.activityCode
            ? String(getValue(row, mapping.activityCode) || '').trim() || undefined
            : undefined,
          name,
          startDate,
          finishDate,
          duration,
          percentComplete: percentComplete ?? undefined,
          metadata: {
            xlsx: {
              row: actualRow,
              wbs: mapping.wbs ? String(getValue(row, mapping.wbs) || '') : undefined,
              notes: mapping.notes
                ? String(getValue(row, mapping.notes) || '')
                : undefined,
            },
          },
        };

        activities.push(activity);

        // Parse predecessors
        if (mapping.predecessors) {
          const predValue = getValue(row, mapping.predecessors);
          if (predValue) {
            const preds = this.parsePredecessors(String(predValue));
            preds.forEach((pred) => {
              relationships.push({
                predecessorExternalId: pred.id,
                successorExternalId: externalId,
                type: pred.type,
                lag: pred.lag,
              });
            });
          }
        }
      } catch (error) {
        errors.push({
          row: actualRow,
          column: 'unknown',
          value: null,
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
        });
      }
    });

    return { activities, relationships, errors, warnings };
  }

  private isValidDate(value: unknown): boolean {
    if (!value) return false;
    const date = this.parseDate(value);
    return date !== null;
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null;

    // Already a Date object
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    // Number (Excel serial date)
    if (typeof value === 'number') {
      // Excel dates are days since 1900-01-01 (with a bug for 1900 leap year)
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }

    // String
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      // Try various date formats
      const formats = [
        /^\d{4}-\d{2}-\d{2}$/, // ISO: 2024-01-15
        /^\d{2}\/\d{2}\/\d{4}$/, // US: 01/15/2024
        /^\d{2}-\d{2}-\d{4}$/, // EU: 15-01-2024
        /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // Flexible: 1/15/24
      ];

      for (const format of formats) {
        if (format.test(trimmed)) {
          const date = new Date(trimmed);
          if (!isNaN(date.getTime())) return date;
        }
      }

      // Try direct parsing
      const date = new Date(trimmed);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  private parseDuration(value: unknown): number {
    if (typeof value === 'number') return Math.max(0, Math.round(value));
    if (typeof value === 'string') {
      const num = parseFloat(value.replace(/[^\d.-]/g, ''));
      return isNaN(num) ? 0 : Math.max(0, Math.round(num));
    }
    return 0;
  }

  private parsePercentage(value: unknown): number | null {
    if (typeof value === 'number') {
      // If value is > 1, assume it's already a percentage
      // If value is <= 1, assume it's a decimal
      const pct = value > 1 ? value : value * 100;
      return Math.max(0, Math.min(100, Math.round(pct)));
    }
    if (typeof value === 'string') {
      const num = parseFloat(value.replace(/[^\d.-]/g, ''));
      if (isNaN(num)) return null;
      const pct = num > 1 ? num : num * 100;
      return Math.max(0, Math.min(100, Math.round(pct)));
    }
    return null;
  }

  private parsePredecessors(
    value: string
  ): Array<{ id: string; type: ExternalRelationship['type']; lag: number }> {
    const results: Array<{
      id: string;
      type: ExternalRelationship['type'];
      lag: number;
    }> = [];

    // Split by comma or semicolon
    const parts = value.split(/[,;]/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Parse format: "ID" or "ID FS" or "ID FS+2" or "ID+2"
      const match = trimmed.match(
        /^([^\s+\-]+)\s*(FS|FF|SS|SF)?\s*([+-]\d+)?$/i
      );

      if (match) {
        const [, id, typeStr, lagStr] = match;
        const type = (typeStr?.toUpperCase() || 'FS') as ExternalRelationship['type'];
        const lag = lagStr ? parseInt(lagStr, 10) : 0;

        results.push({ id: id.trim(), type, lag });
      } else {
        // Just use the whole thing as ID
        results.push({ id: trimmed, type: 'FS', lag: 0 });
      }
    }

    return results;
  }
}

// Singleton instance
export const xlsxImportService = new XLSXImportService();

export default xlsxImportService;
