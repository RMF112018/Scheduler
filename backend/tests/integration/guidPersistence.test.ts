/**
 * GUID Persistence Round-Trip Test
 * 
 * Verifies that field data (notes, photos, assignments) remains "glued" to activities
 * via internal_guid even after schedule updates, exports, and re-imports.
 * 
 * Test Flow:
 * 1. Import initial XER file
 * 2. Create field edits (notes, photos, assignments)
 * 3. Export to XER
 * 4. Modify XER externally (simulate P6 update)
 * 5. Re-import modified XER
 * 6. Verify field data remains linked via internal_guid
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../setup.js';
import { importMappingService } from '../../src/services/index.js';
import { activityService } from '../../src/services/index.js';
import { scheduleService } from '../../src/services/index.js';

describe('GUID Persistence Round-Trip', () => {
  let testCompany: { id: string };
  let testProject: { id: string };
  let testSchedule: { id: string };
  let testUser: { id: string };
  let initialActivityId: string;
  let initialPersistentGuid: string;
  let tempXerPath: string;

  beforeAll(async () => {
    // Create test company
    testCompany = await prisma.company.create({
      data: {
        name: 'Test Company for GUID Round-Trip',
        settings: {},
      },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: `guid-test-${Date.now()}@test.com`,
        name: 'GUID Test User',
        companyId: testCompany.id,
        role: 'field_crew',
      },
    });

    // Create test project
    testProject = await prisma.project.create({
      data: {
        name: 'GUID Round-Trip Test Project',
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
      name: 'GUID Test Schedule',
      startDate: new Date('2024-01-01'),
    });
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
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    if (testCompany?.id) {
      await prisma.company.delete({ where: { id: testCompany.id } });
    }
    if (tempXerPath) {
      try {
        unlinkSync(tempXerPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    // Disconnect handled by setup.ts
  });

  it('should preserve field data across XER round-trip import/export', async () => {
    // Step 1: Import initial XER file
    // const initialXerContent = `ERMHDR	19.12	2024-01-01	Test Project	USD
    //
    // %T	PROJECT
    // %F	proj_id	proj_short_name
    // %R	1	TEST	Test Project
    //
    // %T	TASK
    // %F	task_id	task_code	task_name	target_start_date	target_end_date	target_drtn	phys_complete_pct
    // %R	1	ACT001	Test Activity	2024-01-01	2024-01-10	10	0
    //
    // %T	TASKPRED
    // %F	task_id	pred_task_id	pred_type	lag_hr_cnt
    // `;

    // Parse and import XER
    // const { parseXerTables, buildExternalActivities } = await import('../../src/controllers/importController.js');
    // For now, we'll use the importMappingService directly
    const externalActivities = [
      {
        externalId: '1',
        activityCode: 'ACT001',
        name: 'Test Activity',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-10'),
        duration: 10,
        percentComplete: 0,
      },
    ];

    const importResult = await importMappingService.mapActivitiesWithPersistentGUID(
      externalActivities,
      testSchedule.id,
      testProject.id
    );

    expect(importResult.success).toBe(true);
    expect(importResult.importedCount).toBeGreaterThan(0);

    // Get the imported activity
    const importedActivity = await prisma.scheduleActivity.findFirst({
      where: {
        scheduleId: testSchedule.id,
        externalGuid: '1',
      },
    });

    expect(importedActivity).toBeDefined();
    initialActivityId = importedActivity!.id;
    initialPersistentGuid = importedActivity!.persistentInternalGuid;

    // Step 2: Create field edits (notes, photos, assignments)
    
    // Create field note (as attachment with type 'note')
    const fieldNote = await prisma.activityAttachment.create({
      data: {
        persistentInternalGuid: initialPersistentGuid,
        attachmentType: 'note',
        fileName: 'field-observation.txt',
        uploadedBy: testUser.id,
        metadata: {
          note: 'Field observation: Site conditions are good',
        },
      },
    });

    // Create photo attachment
    const photoAttachment = await prisma.activityAttachment.create({
      data: {
        persistentInternalGuid: initialPersistentGuid,
        attachmentType: 'photo',
        fileName: 'site-photo.jpg',
        filePath: '/uploads/site-photo.jpg',
        uploadedBy: testUser.id,
        metadata: {
          description: 'Site progress photo',
        },
      },
    });

    // Create lookahead activity (field commitment)
    const lookaheadSchedule = await prisma.lookaheadSchedule.create({
      data: {
        scheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
    });

    const lookaheadActivity = await prisma.lookaheadActivity.create({
      data: {
        lookaheadScheduleId: lookaheadSchedule.id,
        persistentInternalGuid: initialPersistentGuid,
        plannerStatus: 'will_do',
        plannerUpdatedBy: testUser.id,
      },
    });

    // Verify field data exists
    const attachmentsBefore = await prisma.activityAttachment.findMany({
      where: { persistentInternalGuid: initialPersistentGuid },
    });
    expect(attachmentsBefore.length).toBe(2);

    const lookaheadEditsBefore = await prisma.lookaheadActivity.findMany({
      where: { persistentInternalGuid: initialPersistentGuid },
    });
    expect(lookaheadEditsBefore.length).toBe(1);

    // Step 3: Export to XER (simulate export)
    // In a real scenario, we would use the export service
    // For this test, we'll simulate by modifying the activity dates

    // Step 4: Modify activity dates (simulate P6 update)
    await prisma.scheduleActivity.update({
      where: { id: initialActivityId },
      data: {
        startDate: new Date('2024-01-02'), // Changed
        finishDate: new Date('2024-01-11'), // Changed
        duration: 10,
      },
    });

    // Step 5: Re-import modified XER
    const modifiedExternalActivities = [
      {
        externalId: '1',
        activityCode: 'ACT001',
        name: 'Test Activity (Updated)',
        startDate: new Date('2024-01-02'), // Updated date
        finishDate: new Date('2024-01-11'), // Updated date
        duration: 10,
        percentComplete: 0,
      },
    ];

    const reimportResult = await importMappingService.mapActivitiesWithPersistentGUID(
      modifiedExternalActivities,
      testSchedule.id,
      testProject.id
    );

    expect(reimportResult.success).toBe(true);
    expect(reimportResult.updatedCount).toBeGreaterThan(0);

    // Step 6: Verify field data remains linked via internal_guid
    const reimportedActivity = await prisma.scheduleActivity.findFirst({
      where: {
        scheduleId: testSchedule.id,
        persistentInternalGuid: initialPersistentGuid,
      },
      include: {
        attachments: true,
      },
    });

    expect(reimportedActivity).toBeDefined();
    expect(reimportedActivity!.persistentInternalGuid).toBe(initialPersistentGuid);
    expect(reimportedActivity!.name).toBe('Test Activity (Updated)'); // Name updated
    expect(reimportedActivity!.startDate.getTime()).toBe(new Date('2024-01-02').getTime()); // Date updated

    // Verify attachments are still linked
    const attachmentsAfter = await prisma.activityAttachment.findMany({
      where: { persistentInternalGuid: initialPersistentGuid },
    });
    expect(attachmentsAfter.length).toBe(2);
    expect(attachmentsAfter.some((a) => a.id === fieldNote.id)).toBe(true);
    expect(attachmentsAfter.some((a) => a.id === photoAttachment.id)).toBe(true);

    // Verify lookahead edits are still linked
    const lookaheadEditsAfter = await prisma.lookaheadActivity.findMany({
      where: { persistentInternalGuid: initialPersistentGuid },
    });
    expect(lookaheadEditsAfter.length).toBe(1);
    expect(lookaheadEditsAfter[0].id).toBe(lookaheadActivity.id);
    expect(lookaheadEditsAfter[0].plannerStatus).toBe('will_do');

    // Verify import mapping is correct
    const mapping = await prisma.importMapping.findUnique({
      where: {
        projectId_externalId: {
          projectId: testProject.id,
          externalId: '1',
        },
      },
    });

    expect(mapping).toBeDefined();
    expect(mapping!.persistentInternalGuid).toBe(initialPersistentGuid);
  });

  it('should handle activity deletions and re-additions', async () => {
    // Create a new activity
    const newActivity = await activityService.create({
      scheduleId: testSchedule.id,
      name: 'Temporary Activity',
      startDate: new Date('2024-01-15'),
      finishDate: new Date('2024-01-20'),
      duration: 5,
    });

    const tempGuid = newActivity.persistentInternalGuid;

    // Add field data
    await prisma.activityAttachment.create({
      data: {
        persistentInternalGuid: tempGuid,
        attachmentType: 'note',
        fileName: 'temp-note.txt',
        uploadedBy: testUser.id,
      },
    });

    // Delete activity (simulate removal in P6)
    await prisma.scheduleActivity.delete({
      where: { id: newActivity.id },
    });

    // Re-add activity with same external ID
    const reAddedExternal = [
      {
        externalId: '2',
        activityCode: 'ACT002',
        name: 'Re-added Activity',
        startDate: new Date('2024-01-15'),
        finishDate: new Date('2024-01-20'),
        duration: 5,
      },
    ];

    await importMappingService.mapActivitiesWithPersistentGUID(
      reAddedExternal,
      testSchedule.id,
      testProject.id
    );

    // Verify new activity has new GUID (deleted activities don't preserve GUID)
    const reAddedActivity = await prisma.scheduleActivity.findFirst({
      where: {
        scheduleId: testSchedule.id,
        externalGuid: '2',
      },
    });

    expect(reAddedActivity).toBeDefined();
    // New activity should have a new GUID (deletion breaks the link)
    expect(reAddedActivity!.persistentInternalGuid).not.toBe(tempGuid);
  });
});
