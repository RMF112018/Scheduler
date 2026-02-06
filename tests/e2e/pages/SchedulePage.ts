import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Schedule Management Page
 */
export class SchedulePage {
  readonly page: Page;
  readonly importButton: Locator;
  readonly exportButton: Locator;
  readonly createBaselineButton: Locator;
  readonly ganttChart: Locator;
  readonly activityList: Locator;
  readonly validationIssues: Locator;

  constructor(page: Page) {
    this.page = page;
    this.importButton = page.getByRole('button', { name: /import/i });
    this.exportButton = page.getByRole('button', { name: /export/i });
    this.createBaselineButton = page.getByRole('button', { name: /create baseline|baseline/i });
    this.ganttChart = page.locator('[data-testid="gantt-chart"]').or(page.locator('.gantt-chart'));
    this.activityList = page.locator('[data-testid="activity-list"]');
    this.validationIssues = page.locator('[data-testid="validation-issues"]');
  }

  async goto(projectId: string, scheduleId?: string) {
    const url = scheduleId
      ? `/projects/${projectId}/schedules/${scheduleId}`
      : `/projects/${projectId}/schedules`;
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  async importFile(filePath: string, fileType: 'xer' | 'xlsx' = 'xlsx') {
    await this.importButton.click();
    await this.page.waitForSelector('[role="dialog"]');
    
    const modal = this.page.locator('[role="dialog"]');
    const fileInput = modal.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    
    // Wait for file processing
    await this.page.waitForTimeout(2000);
    
    // Confirm import
    await modal.getByRole('button', { name: /import|confirm/i }).click();
    
    // Wait for import to complete
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden' });
    await this.page.waitForTimeout(2000);
  }

  async exportSchedule(format: 'xlsx' | 'pdf' | 'xer' | 'xml' = 'xlsx') {
    await this.exportButton.click();
    await this.page.waitForSelector('[role="menu"]');
    
    const menu = this.page.locator('[role="menu"]');
    await menu.getByRole('menuitem', { name: new RegExp(format, 'i') }).click();
    
    // Wait for download to start
    const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
    const download = await downloadPromise;
    return download;
  }

  async createBaseline(baselineName: string) {
    await this.createBaselineButton.click();
    await this.page.waitForSelector('[role="dialog"]');
    
    const modal = this.page.locator('[role="dialog"]');
    await modal.getByLabel(/name/i).fill(baselineName);
    await modal.getByRole('button', { name: /create|save/i }).click();
    
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden' });
  }

  async getValidationIssueCount(): Promise<number> {
    const isVisible = await this.validationIssues.isVisible().catch(() => false);
    if (!isVisible) return 0;
    
    const text = await this.validationIssues.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async updateActivity(activityName: string, updates: { startDate?: string; duration?: number; progress?: number }) {
    // Find activity in list or Gantt chart
    const activity = this.activityList.getByText(activityName).first();
    await activity.click();
    
    // Wait for edit modal or form
    await this.page.waitForSelector('[role="dialog"]');
    const modal = this.page.locator('[role="dialog"]');
    
    if (updates.startDate) {
      await modal.getByLabel(/start date/i).fill(updates.startDate);
    }
    if (updates.duration !== undefined) {
      await modal.getByLabel(/duration/i).fill(updates.duration.toString());
    }
    if (updates.progress !== undefined) {
      await modal.getByLabel(/progress|percent complete/i).fill(updates.progress.toString());
    }
    
    await modal.getByRole('button', { name: /save|update/i }).click();
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden' });
  }
}
