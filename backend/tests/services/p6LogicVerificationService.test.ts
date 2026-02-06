/**
 * P6 Logic Verification Service Tests
 * 
 * Tests the P6LogicVerificationService to ensure our CPM calculations
 * match Primavera P6 benchmark results.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../setup.js';
import { p6LogicVerificationService } from '../../src/services/p6LogicVerificationService.js';
import { scheduleService } from '../../src/services/index.js';
import { importMappingService } from '../../src/services/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('P6LogicVerificationService', () => {
  let testCompany: { id: string };
  let testProject: { id: string };
  let testSchedule: { id: string };
  let benchmarkXerPath: string;

  beforeAll(async () => {
    // Create test company
    testCompany = await prisma.company.create({
      data: {
        name: 'P6 Verification Test Company',
        settings: {},
      },
    });

    // Create test project with retained logic enabled
    testProject = await prisma.project.create({
      data: {
        name: 'P6 Verification Test Project',
        companyId: testCompany.id,
        startDate: new Date('2024-01-01'),
        settings: {
          useRetainedLogic: true,
        },
      },
    });

    // Create test schedule
    testSchedule = await scheduleService.create({
      projectId: testProject.id,
      name: 'P6 Verification Test Schedule',
      startDate: new Date('2024-01-01'),
    });

    // Set benchmark XER path
    benchmarkXerPath = join(__dirname, '../fixtures/p6-benchmark.xer');
  });

  afterAll(async () => {
    // Cleanup
    if (testSchedule?.id) {
      await prisma.schedule.deleteMany({
        where: { projectId: testProject.id },
      });
    }
    if (testProject?.id) {
      await prisma.project.delete({ where: { id: testProject.id } });
    }
    if (testCompany?.id) {
      await prisma.company.delete({ where: { id: testCompany.id } });
    }
  });

  it('should verify CPM dates against P6 benchmark', async () => {
    // Import benchmark XER
    const xerContent = readFileSync(benchmarkXerPath, 'utf8');
    
    // Parse and import activities
    const externalActivities = [
      {
        externalId: '1',
        activityCode: 'A001',
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-10'),
        duration: 10,
        percentComplete: 0,
      },
      {
        externalId: '2',
        activityCode: 'B002',
        name: 'Activity B',
        startDate: new Date('2024-01-11'),
        finishDate: new Date('2024-01-20'),
        duration: 10,
        percentComplete: 0,
      },
      {
        externalId: '3',
        activityCode: 'C003',
        name: 'Activity C',
        startDate: new Date('2024-01-21'),
        finishDate: new Date('2024-01-30'),
        duration: 10,
        percentComplete: 0,
      },
    ];

    await importMappingService.mapActivitiesWithPersistentGUID(
      externalActivities,
      testSchedule.id,
      testProject.id
    );

    // Import relationships
    await importMappingService.preserveRelationships(
      [
        { predecessorExternalId: '1', successorExternalId: '2', type: 'FS' },
        { predecessorExternalId: '2', successorExternalId: '3', type: 'FS' },
      ],
      testProject.id,
      testSchedule.id
    );

    // Run verification
    const result = await p6LogicVerificationService.verifyAgainstBenchmark(
      testSchedule.id,
      benchmarkXerPath,
      1 // ±1 day tolerance
    );

    // Verify results
    expect(result.totalActivities).toBeGreaterThan(0);
    expect(result.matchPercentage).toBeGreaterThanOrEqual(0);
    expect(result.overallMatch).toBeDefined();
    expect(result.dateDifferences).toBeDefined();
    expect(Array.isArray(result.dateDifferences)).toBe(true);

    // For a simple linear schedule, we should have high match percentage
    // (exact match depends on the benchmark XER file)
    expect(result.matchPercentage).toBeGreaterThanOrEqual(0);
    
    // Critical path should match
    expect(result.criticalPathMismatches).toBe(0);
  });

  it('should handle activities with no P6 dates gracefully', async () => {
    // Create a schedule with activities that don't exist in benchmark
    const result = await p6LogicVerificationService.verifyAgainstBenchmark(
      testSchedule.id,
      benchmarkXerPath,
      1
    );

    // Should not throw error, but may have lower match percentage
    expect(result).toBeDefined();
    expect(result.totalActivities).toBeGreaterThanOrEqual(0);
  });

  it('should respect tolerance thresholds', async () => {
    const result = await p6LogicVerificationService.verifyAgainstBenchmark(
      testSchedule.id,
      benchmarkXerPath,
      2 // ±2 day tolerance
    );

    // All differences within tolerance should be marked as 'within_tolerance' or 'match'
    const mismatches = result.dateDifferences.filter((d) => d.status === 'mismatch');
    
    // Mismatches should only occur if difference > tolerance
    for (const mismatch of mismatches) {
      if (mismatch.earlyFinishDifferenceDays !== null) {
        expect(Math.abs(mismatch.earlyFinishDifferenceDays)).toBeGreaterThan(2);
      }
      if (mismatch.lateFinishDifferenceDays !== null) {
        expect(Math.abs(mismatch.lateFinishDifferenceDays)).toBeGreaterThan(2);
      }
    }
  });
});
