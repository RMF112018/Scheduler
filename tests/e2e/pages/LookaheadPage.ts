import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Lookahead View
 */
export class LookaheadPage {
  readonly page: Page;
  readonly shouldDoButton: Locator;
  readonly willDoButton: Locator;
  readonly commitButton: Locator;
  readonly conflictAlert: Locator;
  readonly offlineIndicator: Locator;
  readonly activityCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.shouldDoButton = page.getByRole('button', { name: /should do/i });
    this.willDoButton = page.getByRole('button', { name: /will do/i });
    this.commitButton = page.getByRole('button', { name: /commit|submit/i });
    this.conflictAlert = page.locator('[data-testid="conflict-alert"]').or(page.locator('.conflict-alert'));
    this.offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    this.activityCard = page.locator('[data-testid="activity-card"]').or(page.locator('.activity-card'));
  }

  async goto(projectId: string, lookaheadId?: string) {
    const url = lookaheadId 
      ? `/projects/${projectId}/lookahead/${lookaheadId}`
      : `/projects/${projectId}/lookahead`;
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  async markActivityAsShouldDo(activityName: string) {
    const activity = this.getActivityCard(activityName);
    await activity.locator('button:has-text("Should Do")').click();
    await this.page.waitForTimeout(500); // Wait for state update
  }

  async markActivityAsWillDo(activityName: string) {
    const activity = this.getActivityCard(activityName);
    await activity.locator('button:has-text("Will Do")').click();
    await this.page.waitForTimeout(500); // Wait for state update
  }

  async commitChanges() {
    await this.commitButton.click();
    // Wait for commit confirmation modal
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  }

  async confirmCommit() {
    const modal = this.page.locator('[role="dialog"]');
    await modal.getByRole('checkbox').check();
    await modal.getByRole('button', { name: /confirm|commit/i }).click();
    // Wait for modal to close and navigation
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden' });
  }

  async hasConflicts(): Promise<boolean> {
    const isVisible = await this.conflictAlert.isVisible().catch(() => false);
    return isVisible;
  }

  async getConflictCount(): Promise<number> {
    const text = await this.conflictAlert.textContent().catch(() => '');
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async isOffline(): Promise<boolean> {
    const isVisible = await this.offlineIndicator.isVisible().catch(() => false);
    if (!isVisible) return false;
    const text = await this.offlineIndicator.textContent();
    return text?.toLowerCase().includes('offline') ?? false;
  }

  getActivityCard(activityName: string): Locator {
    return this.activityCard.filter({ hasText: activityName }).first();
  }

  async addAttachment(activityName: string, filePath: string) {
    const activity = this.getActivityCard(activityName);
    const fileInput = activity.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await this.page.waitForTimeout(1000); // Wait for upload
  }

  async addComment(activityName: string, comment: string) {
    const activity = this.getActivityCard(activityName);
    await activity.getByRole('button', { name: /comment/i }).click();
    await this.page.waitForSelector('[data-testid="comment-input"]');
    await this.page.locator('[data-testid="comment-input"]').fill(comment);
    await this.page.getByRole('button', { name: /post|submit/i }).click();
    await this.page.waitForTimeout(500);
  }
}
