/**
 * Page Object Model for Schedule Detail Page
 * 
 * Encapsulates selectors and actions for schedule detail view including:
 * - Activity management
 * - CPM calculation verification
 * - Import/Export operations
 * - Gantt chart interactions
 */

import { Page, Locator, expect } from '@playwright/test';

export class ScheduleDetailPage {
  readonly page: Page;
  readonly ganttChart: Locator;
  readonly activityList: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;
  readonly calculateCPMButton: Locator;
  readonly criticalPathIndicator: Locator;
  readonly activityRow: Locator;
  readonly editActivityButton: Locator;
  readonly exportPDFButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.ganttChart = page.locator('[data-testid="gantt-chart"]').or(page.locator('.gantt-chart'));
    this.activityList = page.locator('[data-testid="activity-list"]').or(page.locator('.activity-list'));
    this.importButton = page.getByRole('button', { name: /import/i });
    this.exportButton = page.getByRole('button', { name: /export/i });
    this.calculateCPMButton = page.getByRole('button', { name: /calculate.*cpm|recalculate/i });
    this.criticalPathIndicator = page.locator('[data-testid="critical-path"]').or(page.locator('.critical-path'));
    this.activityRow = page.locator('[data-testid="activity-row"]').or(page.locator('tr[data-activity-id]'));
    this.editActivityButton = page.getByRole('button', { name: /edit|update/i });
    this.exportPDFButton = page.getByRole('button', { name: /export.*pdf|pdf/i });
  }

  /**
   * Navigate to schedule detail page
   */
  async goto(projectId: string, scheduleId: string) {
    await this.page.goto(`/projects/${projectId}/schedules/${scheduleId}`);
    await this.page.waitForLoadState('networkidle');
    // Wait for schedule data to load
    await this.page.waitForSelector('[data-testid="activity-list"], .activity-list', { timeout: 10000 });
  }

  /**
   * Import XER file
   */
  async importXER(filePath: string): Promise<void> {
    await this.importButton.click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const modal = this.page.locator('[role="dialog"]');
    
    // Select XER format if there's a format selector
    const formatSelect = modal.locator('select, [role="radiogroup"]').first();
    if (await formatSelect.isVisible().catch(() => false)) {
      await formatSelect.selectOption('xer');
    }

    const fileInput = modal.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for file processing
    await this.page.waitForTimeout(2000);

    // Confirm import
    await modal.getByRole('button', { name: /import|confirm|upload/i }).click();

    // Wait for import to complete
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 30000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Export schedule to PDF
   */
  async exportPDF(): Promise<import('@playwright/test').Download> {
    await this.exportButton.click();
    await this.page.waitForSelector('[role="menu"]', { timeout: 5000 });

    const menu = this.page.locator('[role="menu"]');
    await menu.getByRole('menuitem', { name: /pdf/i }).click();

    // Wait for download to start
    const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
    return downloadPromise;
  }

  /**
   * Update an activity's duration
   */
  async updateActivityDuration(activityName: string, newDuration: number): Promise<void> {
    // Find and click activity
    const activity = this.activityRow.filter({ hasText: activityName }).first();
    await activity.click();

    // Wait for edit modal
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const modal = this.page.locator('[role="dialog"]');

    // Update duration
    const durationInput = modal.getByLabel(/duration/i);
    await durationInput.clear();
    await durationInput.fill(newDuration.toString());

    // Save changes
    await modal.getByRole('button', { name: /save|update/i }).click();
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden' });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify CPM recalculation by checking critical path
   */
  async verifyCPMRecalculated(): Promise<boolean> {
    // Trigger CPM calculation if button exists
    if (await this.calculateCPMButton.isVisible().catch(() => false)) {
      await this.calculateCPMButton.click();
      await this.page.waitForTimeout(2000); // Wait for calculation
    }

    // Verify critical path is displayed
    const hasCriticalPath = await this.criticalPathIndicator.isVisible().catch(() => false);
    
    // Verify activities have isCritical flag
    const criticalActivities = this.activityRow.filter({ hasText: /critical/i });
    const count = await criticalActivities.count();
    
    return hasCriticalPath || count > 0;
  }

  /**
   * Get activity finish date from the UI
   */
  async getActivityFinishDate(activityName: string): Promise<string | null> {
    const activity = this.activityRow.filter({ hasText: activityName }).first();
    if (!(await activity.isVisible().catch(() => false))) {
      return null;
    }

    // Try to find finish date in the row
    const finishDateCell = activity.locator('[data-testid="finish-date"], td:nth-child(4)');
    const text = await finishDateCell.textContent().catch(() => null);
    return text?.trim() || null;
  }

  /**
   * Verify Gantt chart is rendered
   */
  async verifyGanttChartRendered(): Promise<boolean> {
    return await this.ganttChart.isVisible().catch(() => false);
  }

  /**
   * Measure Gantt chart render performance
   */
  async measureGanttRenderTime(): Promise<number> {
    const startTime = Date.now();
    
    // Navigate to ensure fresh render
    await this.page.reload();
    await this.ganttChart.waitFor({ state: 'visible', timeout: 10000 });
    
    const endTime = Date.now();
    return endTime - startTime;
  }

  /**
   * Get activity count from the list
   */
  async getActivityCount(): Promise<number> {
    const rows = this.activityRow;
    return await rows.count();
  }

  /**
   * Wait for API response time for schedule data
   */
  async measureAPILoadTime(): Promise<number> {
    const startTime = Date.now();
    
    // Monitor network requests
    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/api/v1/schedules/') && response.status() === 200,
      { timeout: 10000 }
    );

    await this.page.reload();
    const response = await responsePromise;
    const endTime = Date.now();

    return endTime - startTime;
  }
}
