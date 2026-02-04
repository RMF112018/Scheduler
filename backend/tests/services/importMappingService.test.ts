import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../setup.js';
import { ImportMappingService } from '../../src/services/importMappingService.js';
import {
  createTestCompany,
  createTestUser,
  createTestProject,
  createTestSchedule,
  createTestActivities,
} from '../helpers/testUtils.js';

describe('ImportMappingService', () => {
  let importMappingService: ImportMappingService;
  let testCompany: { id: string; name: string };
  let testUser: { id: string; email: string; companyId: string };
  let testProject: { id: string; name: string; companyId: string; createdBy: string };
  let testSchedule: { id: string; name: string; projectId: string; createdBy: string };
  let activityIds: string[];

  beforeEach(async () => {
    importMappingService = new ImportMappingService();
    
    // Create test data
    testCompany = await createTestCompany('Test Construction Co');
    testUser = await createTestUser(testCompany.id, { role: 'pm' });
    testProject = await createTestProject(testCompany.id, testUser.id);
    testSchedule = await createTestSchedule(testProject.id, testUser.id);
    activityIds = await createTestActivities(testSchedule.id, 3);
  });

  describe('mapExternalGUIDToPersistent', () => {
    it('should create a new mapping for a new external ID', async () => {
      const externalId = 'P6-ACTIVITY-001';

      const persistentGuid = await importMappingService.mapExternalGUIDToPersistent(
        externalId,
        testProject.id,
        testSchedule.id
      );

      expect(persistentGuid).toBeDefined();
      expect(persistentGuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      // Verify mapping was created
      const mapping = await prisma.importMapping.findUnique({
        where: {
          projectId_externalId: {
            projectId: testProject.id,
            externalId,
          },
        },
      });

      expect(mapping).not.toBeNull();
      expect(mapping?.persistentInternalGuid).toBe(persistentGuid);
    });

    it('should return existing mapping for known external ID', async () => {
      const externalId = 'P6-ACTIVITY-002';

      // First call creates mapping
      const firstGuid = await importMappingService.mapExternalGUIDToPersistent(
        externalId,
        testProject.id,
        testSchedule.id
      );

      // Second call should return same GUID
      const secondGuid = await importMappingService.mapExternalGUIDToPersistent(
        externalId,
        testProject.id,
        testSchedule.id
      );

      expect(firstGuid).toBe(secondGuid);
    });

    it('should update lastImportedAt on subsequent calls', async () => {
      const externalId = 'P6-ACTIVITY-003';

      await importMappingService.mapExternalGUIDToPersistent(
        externalId,
        testProject.id,
        testSchedule.id
      );

      const firstMapping = await prisma.importMapping.findUnique({
        where: {
          projectId_externalId: {
            projectId: testProject.id,
            externalId,
          },
        },
      });

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await importMappingService.mapExternalGUIDToPersistent(
        externalId,
        testProject.id,
        testSchedule.id
      );

      const secondMapping = await prisma.importMapping.findUnique({
        where: {
          projectId_externalId: {
            projectId: testProject.id,
            externalId,
          },
        },
      });

      expect(secondMapping?.lastImportedAt.getTime()).toBeGreaterThanOrEqual(
        firstMapping?.lastImportedAt.getTime() ?? 0
      );
    });
  });

  describe('getPersistentGuid', () => {
    it('should return persistent GUID for existing mapping', async () => {
      const externalId = 'P6-ACTIVITY-004';

      const createdGuid = await importMappingService.mapExternalGUIDToPersistent(
        externalId,
        testProject.id,
        testSchedule.id
      );

      const retrievedGuid = await importMappingService.getPersistentGuid(
        externalId,
        testProject.id
      );

      expect(retrievedGuid).toBe(createdGuid);
    });

    it('should return null for non-existent mapping', async () => {
      const guid = await importMappingService.getPersistentGuid(
        'NON-EXISTENT-ID',
        testProject.id
      );

      expect(guid).toBeNull();
    });
  });

  describe('preserveFieldTies', () => {
    it('should return attachments and lookahead edits for an activity', async () => {
      // Get an existing activity's persistent GUID
      const activity = await prisma.scheduleActivity.findFirst({
        where: { scheduleId: testSchedule.id },
      });

      expect(activity).not.toBeNull();

      // Create an attachment
      await prisma.activityAttachment.create({
        data: {
          persistentInternalGuid: activity!.persistentInternalGuid,
          attachmentType: 'photo',
          fileName: 'test-photo.jpg',
          uploadedBy: testUser.id,
        },
      });

      // Create a lookahead with activity
      const lookahead = await prisma.lookaheadSchedule.create({
        data: {
          masterScheduleId: testSchedule.id,
          projectId: testProject.id,
          name: 'Test Lookahead',
          startDate: new Date(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.lookaheadActivity.create({
        data: {
          lookaheadScheduleId: lookahead.id,
          persistentInternalGuid: activity!.persistentInternalGuid,
          name: activity!.name,
          startDate: activity!.startDate,
          finishDate: activity!.finishDate,
          duration: activity!.duration,
          plannerStatus: 'will_do',
        },
      });

      // Test preserveFieldTies
      const result = await importMappingService.preserveFieldTies(
        activity!.persistentInternalGuid
      );

      expect(result.preserved).toBe(true);
      expect(result.attachments.length).toBe(1);
      expect(result.attachments[0].fileName).toBe('test-photo.jpg');
      expect(result.lookaheadEdits.length).toBe(1);
      expect(result.lookaheadEdits[0].plannerStatus).toBe('will_do');
    });

    it('should return preserved=false when no field data exists', async () => {
      const activity = await prisma.scheduleActivity.findFirst({
        where: { scheduleId: testSchedule.id },
      });

      const result = await importMappingService.preserveFieldTies(
        activity!.persistentInternalGuid
      );

      expect(result.preserved).toBe(false);
      expect(result.attachments.length).toBe(0);
      expect(result.lookaheadEdits.length).toBe(0);
    });
  });

  describe('previewImportDiff', () => {
    it('should identify new activities', async () => {
      const externalActivities = [
        {
          externalId: 'NEW-ACTIVITY-001',
          name: 'New Activity 1',
          startDate: new Date(),
          finishDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          duration: 5,
        },
        {
          externalId: 'NEW-ACTIVITY-002',
          name: 'New Activity 2',
          startDate: new Date(),
          finishDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          duration: 3,
        },
      ];

      const diff = await importMappingService.previewImportDiff(
        externalActivities,
        testSchedule.id,
        testProject.id
      );

      expect(diff.newActivities.length).toBe(2);
      expect(diff.summary.totalNew).toBe(2);
      expect(diff.updatedActivities.length).toBe(0);
      expect(diff.deletedActivities.length).toBe(0);
    });

    it('should identify updated activities', async () => {
      // First, create a mapping for an existing activity
      const existingActivity = await prisma.scheduleActivity.findFirst({
        where: { scheduleId: testSchedule.id },
      });

      const externalId = 'MAPPED-ACTIVITY-001';
      await prisma.importMapping.create({
        data: {
          externalId,
          projectId: testProject.id,
          scheduleId: testSchedule.id,
          persistentInternalGuid: existingActivity!.persistentInternalGuid,
        },
      });

      // Create import data with changed values
      const newFinishDate = new Date(existingActivity!.finishDate);
      newFinishDate.setDate(newFinishDate.getDate() + 5);

      const externalActivities = [
        {
          externalId,
          name: existingActivity!.name,
          startDate: existingActivity!.startDate,
          finishDate: newFinishDate,
          duration: existingActivity!.duration + 5,
        },
      ];

      const diff = await importMappingService.previewImportDiff(
        externalActivities,
        testSchedule.id,
        testProject.id
      );

      expect(diff.updatedActivities.length).toBe(1);
      expect(diff.summary.totalUpdated).toBe(1);
      expect(diff.updatedActivities[0].changes.length).toBeGreaterThan(0);
      
      const finishDateChange = diff.updatedActivities[0].changes.find(
        (c) => c.field === 'finishDate'
      );
      expect(finishDateChange).toBeDefined();
    });

    it('should identify deleted activities', async () => {
      // Get existing activities
      const existingActivities = await prisma.scheduleActivity.findMany({
        where: { scheduleId: testSchedule.id },
      });

      // Create mappings for all existing activities
      for (const activity of existingActivities) {
        await prisma.importMapping.create({
          data: {
            externalId: `EXT-${activity.id}`,
            projectId: testProject.id,
            scheduleId: testSchedule.id,
            persistentInternalGuid: activity.persistentInternalGuid,
          },
        });
      }

      // Import with only one activity (others will be "deleted")
      const externalActivities = [
        {
          externalId: `EXT-${existingActivities[0].id}`,
          name: existingActivities[0].name,
          startDate: existingActivities[0].startDate,
          finishDate: existingActivities[0].finishDate,
          duration: existingActivities[0].duration,
        },
      ];

      const diff = await importMappingService.previewImportDiff(
        externalActivities,
        testSchedule.id,
        testProject.id
      );

      expect(diff.deletedActivities.length).toBe(existingActivities.length - 1);
      expect(diff.summary.totalDeleted).toBe(existingActivities.length - 1);
    });
  });

  describe('mapActivitiesWithPersistentGUID', () => {
    it('should import new activities', async () => {
      const externalActivities = [
        {
          externalId: 'IMPORT-001',
          activityCode: 'A001',
          name: 'Imported Activity 1',
          startDate: new Date(),
          finishDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          duration: 5,
          percentComplete: 0,
        },
      ];

      const result = await importMappingService.mapActivitiesWithPersistentGUID(
        externalActivities,
        testSchedule.id,
        testProject.id
      );

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
      expect(result.errors.length).toBe(0);

      // Verify activity was created
      const importedActivity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: testSchedule.id,
          externalGuid: 'IMPORT-001',
        },
      });

      expect(importedActivity).not.toBeNull();
      expect(importedActivity?.name).toBe('Imported Activity 1');
    });

    it('should update existing activities', async () => {
      // First import
      const externalActivities = [
        {
          externalId: 'IMPORT-002',
          activityCode: 'A002',
          name: 'Original Name',
          startDate: new Date(),
          finishDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          duration: 5,
          percentComplete: 0,
        },
      ];

      await importMappingService.mapActivitiesWithPersistentGUID(
        externalActivities,
        testSchedule.id,
        testProject.id
      );

      // Second import with updated name
      const updatedActivities = [
        {
          externalId: 'IMPORT-002',
          activityCode: 'A002',
          name: 'Updated Name',
          startDate: new Date(),
          finishDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          duration: 5,
          percentComplete: 50,
        },
      ];

      const result = await importMappingService.mapActivitiesWithPersistentGUID(
        updatedActivities,
        testSchedule.id,
        testProject.id
      );

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(0);
      expect(result.updatedCount).toBe(1);

      // Verify activity was updated
      const updatedActivity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: testSchedule.id,
          externalGuid: 'IMPORT-002',
        },
      });

      expect(updatedActivity?.name).toBe('Updated Name');
      expect(updatedActivity?.percentComplete).toBe(50);
    });

    it('should skip updates not in diffApproval', async () => {
      // First import
      const externalActivities = [
        {
          externalId: 'IMPORT-003',
          name: 'Original Name',
          startDate: new Date(),
          finishDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          duration: 5,
        },
      ];

      await importMappingService.mapActivitiesWithPersistentGUID(
        externalActivities,
        testSchedule.id,
        testProject.id
      );

      // Get the persistent GUID
      const mapping = await prisma.importMapping.findUnique({
        where: {
          projectId_externalId: {
            projectId: testProject.id,
            externalId: 'IMPORT-003',
          },
        },
      });

      // Second import with diffApproval that doesn't include this activity
      const updatedActivities = [
        {
          externalId: 'IMPORT-003',
          name: 'Should Not Update',
          startDate: new Date(),
          finishDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          duration: 5,
        },
      ];

      const result = await importMappingService.mapActivitiesWithPersistentGUID(
        updatedActivities,
        testSchedule.id,
        testProject.id,
        {
          approvedChanges: [], // Empty - no changes approved
          preserveFieldData: true,
        }
      );

      expect(result.skippedCount).toBe(1);
      expect(result.updatedCount).toBe(0);

      // Verify activity was NOT updated
      const activity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: testSchedule.id,
          externalGuid: 'IMPORT-003',
        },
      });

      expect(activity?.name).toBe('Original Name');
    });
  });

  describe('preserveRelationships', () => {
    it('should create predecessor/successor relationships', async () => {
      // Create mappings for two activities
      const activities = await prisma.scheduleActivity.findMany({
        where: { scheduleId: testSchedule.id },
        take: 2,
      });

      const extId1 = 'REL-001';
      const extId2 = 'REL-002';

      await prisma.importMapping.create({
        data: {
          externalId: extId1,
          projectId: testProject.id,
          scheduleId: testSchedule.id,
          persistentInternalGuid: activities[0].persistentInternalGuid,
        },
      });

      await prisma.importMapping.create({
        data: {
          externalId: extId2,
          projectId: testProject.id,
          scheduleId: testSchedule.id,
          persistentInternalGuid: activities[1].persistentInternalGuid,
        },
      });

      // Clear existing relationships
      await prisma.scheduleActivity.update({
        where: { id: activities[0].id },
        data: { successorIds: [] },
      });
      await prisma.scheduleActivity.update({
        where: { id: activities[1].id },
        data: { predecessorIds: [] },
      });

      // Preserve relationships
      await importMappingService.preserveRelationships(
        [
          {
            predecessorExternalId: extId1,
            successorExternalId: extId2,
            type: 'FS',
          },
        ],
        testProject.id,
        testSchedule.id
      );

      // Verify relationships were created
      const predecessor = await prisma.scheduleActivity.findUnique({
        where: { id: activities[0].id },
      });
      const successor = await prisma.scheduleActivity.findUnique({
        where: { id: activities[1].id },
      });

      expect(predecessor?.successorIds).toContain(activities[1].id);
      expect(successor?.predecessorIds).toContain(activities[0].id);
    });
  });

  describe('getMappingsByProject', () => {
    it('should return all mappings for a project', async () => {
      // Create multiple mappings
      await importMappingService.mapExternalGUIDToPersistent(
        'EXT-A',
        testProject.id,
        testSchedule.id
      );
      await importMappingService.mapExternalGUIDToPersistent(
        'EXT-B',
        testProject.id,
        testSchedule.id
      );
      await importMappingService.mapExternalGUIDToPersistent(
        'EXT-C',
        testProject.id,
        testSchedule.id
      );

      const mappings = await importMappingService.getMappingsByProject(testProject.id);

      expect(mappings.length).toBe(3);
    });
  });

  describe('deleteMappingsByProject', () => {
    it('should delete all mappings for a project', async () => {
      // Create mappings
      await importMappingService.mapExternalGUIDToPersistent(
        'DELETE-A',
        testProject.id,
        testSchedule.id
      );
      await importMappingService.mapExternalGUIDToPersistent(
        'DELETE-B',
        testProject.id,
        testSchedule.id
      );

      const deletedCount = await importMappingService.deleteMappingsByProject(testProject.id);

      expect(deletedCount).toBe(2);

      const remainingMappings = await importMappingService.getMappingsByProject(testProject.id);
      expect(remainingMappings.length).toBe(0);
    });
  });
});
