/**
 * Page Object Model for Lookahead View Page
 * 
 * Encapsulates selectors and actions for lookahead view including:
 * - Activity status updates (Should Do / Will Do)
 * - Attachment uploads
 * - Commit workflow
 * - Offline sync operations
 */

import { Page, Locator } from '@playwright/test';

export class LookaheadViewPage {
  readonly page: Page;
  readonly activityCard: Locator;
  readonly shouldDoButton: Locator;
  readonly willDoButton: Locator;
  readonly commitButton: Locator;
  readonly attachPhotoButton: Locator;
  readonly offlineIndicator: Locator;
  readonly conflictAlert: Locator;
  readonly syncButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.activityCard = page.locator('[data-testid="activity-card"]').or(page.locator('.activity-card'));
    this.shouldDoButton = page.getByRole('button', { name: /should do/i });
    this.willDoButton = page.getByRole('button', { name: /will do/i });
    this.commitButton = page.getByRole('button', { name: /commit|submit/i });
    this.attachPhotoButton = page.getByRole('button', { name: /attach|photo|upload/i });
    this.offlineIndicator = page.locator('[data-testid="offline-indicator"]').or(page.locator('.offline-banner'));
    this.conflictAlert = page.locator('[data-testid="conflict-alert"]').or(page.locator('.conflict-alert'));
    this.syncButton = page.getByRole('button', { name: /sync|reconnect/i });
  }

  /**
   * Navigate to lookahead view
   */
  async goto(projectId: string, lookaheadId?: string) {
    const url = lookaheadId
      ? `/projects/${projectId}/lookahead/${lookaheadId}`
      : `/projects/${projectId}/lookahead`;
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
    // Wait for activities to load
    await this.page.waitForSelector('[data-testid="activity-card"], .activity-card', { timeout: 10000 });
  }

  /**
   * Get activity card by name
   */
  getActivityCard(activityName: string): Locator {
    return this.activityCard.filter({ hasText: activityName }).first();
  }

  /**
   * Mark activity as "Should Do"
   */
  async markAsShouldDo(activityName: string): Promise<void> {
    const activity = this.getActivityCard(activityName);
    const button = activity.locator('button:has-text("Should Do")').first();
    
    // Verify button meets 44x44px touch target
    const box = await button.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    
    await button.click();
    await this.page.waitForTimeout(500); // Wait for state update
  }

  /**
   * Mark activity as "Will Do"
   */
  async markAsWillDo(activityName: string): Promise<void> {
    const activity = this.getActivityCard(activityName);
    const button = activity.locator('button:has-text("Will Do")').first();
    
    // Verify button meets 44x44px touch target
    const box = await button.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    
    await button.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Attach photo to activity
   */
  async attachPhoto(activityName: string, filePath: string): Promise<void> {
    const activity = this.getActivityCard(activityName);
    
    // Click attach button
    const attachButton = activity.locator('button:has-text("Attach"), button[aria-label*="attach"]').first();
    await attachButton.click();
    
    // Wait for file input
    await this.page.waitForTimeout(500);
    const fileInput = this.page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(filePath);
    
    // Wait for upload to complete
    await this.page.waitForTimeout(2000);
  }

  /**
   * Commit lookahead changes
   */
  async commitLookahead(): Promise<void> {
    await this.commitButton.click();
    
    // Wait for commit confirmation modal
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    const modal = this.page.locator('[role="dialog"]');
    
    // Check confirmation checkbox if present
    const checkbox = modal.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
    }
    
    // Confirm commit
    await modal.getByRole('button', { name: /confirm|commit/i }).click();
    
    // Wait for modal to close
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Go offline (simulate network disconnection)
   */
  async goOffline(): Promise<void> {
    await this.page.context().setOffline(true);
    await this.page.waitForTimeout(1000);
    
    // Verify offline indicator appears
    await this.offlineIndicator.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Go online (reconnect network)
   */
  async goOnline(): Promise<void> {
    await this.page.context().setOffline(false);
    await this.page.waitForTimeout(1000);
    
    // Wait for sync to trigger
    if (await this.syncButton.isVisible().catch(() => false)) {
      await this.syncButton.click();
    }
    
    // Wait for sync to complete
    await this.page.waitForTimeout(3000);
  }

  /**
   * Check if conflicts are detected
   */
  async hasConflicts(): Promise<boolean> {
    return await this.conflictAlert.isVisible().catch(() => false);
  }

  /**
   * Get conflict count
   */
  async getConflictCount(): Promise<number> {
    if (!(await this.hasConflicts())) {
      return 0;
    }
    
    const text = await this.conflictAlert.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Verify activity has attachment
   */
  async verifyActivityHasAttachment(activityName: string): Promise<boolean> {
    const activity = this.getActivityCard(activityName);
    const attachmentIndicator = activity.locator('[data-testid="attachment"], .attachment-icon');
    return await attachmentIndicator.isVisible().catch(() => false);
  }

  /**
   * Get activity internal GUID from data attribute (for GUID persistence verification)
   */
  async getActivityInternalGuid(activityName: string): Promise<string | null> {
    const activity = this.getActivityCard(activityName);
    const guid = await activity.getAttribute('data-internal-guid');
    return guid;
  }
}
