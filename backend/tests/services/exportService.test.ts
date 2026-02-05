/**
 * Export Service Tests
 *
 * Tests for XLSX and PDF export functionality including:
 * - Basic export generation
 * - Variance analysis
 * - Critical path export
 * - Data formatting
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { exportService } from '../../src/services/exportService.js';
import {
  createTestCompany,
  createTestUser,
  createTestProject,
  createTestSchedule,
  cleanupTestData,
} from '../helpers/testUtils.js';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

describe('ExportService', () => {
  let testCompanyId: string;
  let testProjectId: string;
  let testScheduleId: string;
  let testBaselineId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Create test company
    const company = await createTestCompany(`Export Test Company ${Date.now()}`);
    testCompanyId = company.id;

    // Create test user
    const user = await createTestUser(testCompanyId);
    testUserId = user.id;

    // Create test project
    const project = await createTestProject(testCompanyId, testUserId, {
      name: 'Export Test Project',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
    });
    testProjectId = project.id;

    // Create test schedule
    const schedule = await createTestSchedule(testProjectId, testUserId, {
      name: 'Export Test Schedule',
    });
    testScheduleId = schedule.id;

    // Create test activities
    const timestamp = Date.now();
    const activities = [
      {
        scheduleId: testScheduleId,
        persistentInternalGuid: `guid-export-1-${timestamp}`,
        activityCode: 'A1000',
        name: 'Foundation Work',
        startDate: new Date('2024-01-15'),
        finishDate: new Date('2024-02-15'),
        duration: 30,
        percentComplete: 100,
        isCritical: true,
        totalFloat: 0,
        predecessorIds: [],
        successorIds: [],
      },
      {
        scheduleId: testScheduleId,
        persistentInternalGuid: `guid-export-2-${timestamp}`,
        activityCode: 'A1010',
        name: 'Structural Steel',
        startDate: new Date('2024-02-16'),
        finishDate: new Date('2024-04-15'),
        duration: 60,
        percentComplete: 75,
        isCritical: true,
        totalFloat: 0,
        predecessorIds: [],
        successorIds: [],
      },
      {
        scheduleId: testScheduleId,
        persistentInternalGuid: `guid-export-3-${timestamp}`,
        activityCode: 'A1020',
        name: 'Electrical Rough-in',
        startDate: new Date('2024-03-01'),
        finishDate: new Date('2024-05-01'),
        duration: 60,
        percentComplete: 50,
        isCritical: false,
        totalFloat: 10,
        predecessorIds: [],
        successorIds: [],
      },
      {
        scheduleId: testScheduleId,
        persistentInternalGuid: `guid-export-4-${timestamp}`,
        activityCode: 'A1030',
        name: 'HVAC Installation',
        startDate: new Date('2024-04-01'),
        finishDate: new Date('2024-06-01'),
        duration: 60,
        percentComplete: 25,
        isCritical: false,
        totalFloat: 15,
        predecessorIds: [],
        successorIds: [],
      },
    ];

    await prisma.scheduleActivity.createMany({ data: activities });

    // Create baseline for variance testing
    const baselineActivities = activities.map((a) => ({
      persistentInternalGuid: a.persistentInternalGuid,
      activityCode: a.activityCode,
      name: a.name,
      startDate: a.startDate.toISOString(),
      finishDate: new Date(a.finishDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days earlier
      duration: a.duration - 5,
    }));

    const baseline = await prisma.scheduleBaseline.create({
      data: {
        scheduleId: testScheduleId,
        version: 1,
        snapshotData: { activities: baselineActivities },
      },
    });
    testBaselineId = baseline.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('exportToXLSX', () => {
    it('should export schedule to XLSX format', async () => {
      const buffer = await exportService.exportToXLSX(testScheduleId);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Parse the XLSX to verify content
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Activities');
      expect(workbook.SheetNames).toContain('Summary');
    });

    it('should include all activities in export', async () => {
      const buffer = await exportService.exportToXLSX(testScheduleId);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets['Activities'];
      const data = XLSX.utils.sheet_to_json(sheet);

      expect(data.length).toBe(4); // 4 test activities
    });

    it('should include variance sheet when requested', async () => {
      const buffer = await exportService.exportToXLSX(testScheduleId, {
        includeVariance: true,
        baselineId: testBaselineId,
      });

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Variance Analysis');
    });

    it('should include critical path sheet when requested', async () => {
      const buffer = await exportService.exportToXLSX(testScheduleId, {
        includeCriticalPath: true,
      });

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Critical Path');

      const sheet = workbook.Sheets['Critical Path'];
      const data = XLSX.utils.sheet_to_json(sheet);
      expect(data.length).toBe(2); // 2 critical activities
    });

    it('should format dates correctly', async () => {
      const buffer = await exportService.exportToXLSX(testScheduleId);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets['Activities'];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const firstActivity = data[0];
      expect(firstActivity['Start Date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(firstActivity['Finish Date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should include summary statistics', async () => {
      const buffer = await exportService.exportToXLSX(testScheduleId);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets['Summary'];
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

      // Find the row with total activities
      const totalRow = data.find((row) => row[0] === 'Total Activities');
      expect(totalRow).toBeDefined();
      expect(totalRow![1]).toBe(4);
    });
  });

  describe('exportToPDF', () => {
    it('should export schedule to PDF format', async () => {
      const buffer = await exportService.exportToPDF(testScheduleId);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Check PDF header
      const header = buffer.slice(0, 5).toString();
      expect(header).toBe('%PDF-');
    });

    it('should include title page with custom title', async () => {
      const buffer = await exportService.exportToPDF(testScheduleId, {
        title: 'Custom Report Title',
        subtitle: 'Monthly Progress Report',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should include variance analysis when requested', async () => {
      const buffer = await exportService.exportToPDF(testScheduleId, {
        includeVariance: true,
        baselineId: testBaselineId,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should include critical path when requested', async () => {
      const buffer = await exportService.exportToPDF(testScheduleId, {
        includeCriticalPath: true,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should support different page sizes', async () => {
      const bufferA4 = await exportService.exportToPDF(testScheduleId, {
        pageSize: 'A4',
      });
      const bufferLetter = await exportService.exportToPDF(testScheduleId, {
        pageSize: 'LETTER',
      });

      expect(bufferA4).toBeInstanceOf(Buffer);
      expect(bufferLetter).toBeInstanceOf(Buffer);
    });

    it('should support different orientations', async () => {
      const bufferLandscape = await exportService.exportToPDF(testScheduleId, {
        orientation: 'landscape',
      });
      const bufferPortrait = await exportService.exportToPDF(testScheduleId, {
        orientation: 'portrait',
      });

      expect(bufferLandscape).toBeInstanceOf(Buffer);
      expect(bufferPortrait).toBeInstanceOf(Buffer);
    });
  });

  describe('error handling', () => {
    it('should throw error for non-existent schedule', async () => {
      await expect(
        exportService.exportToXLSX('non-existent-id')
      ).rejects.toThrow('Schedule not found');
    });

    it('should throw error for non-existent schedule in PDF export', async () => {
      await expect(
        exportService.exportToPDF('non-existent-id')
      ).rejects.toThrow('Schedule not found');
    });
  });
});
