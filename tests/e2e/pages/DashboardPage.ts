import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Executive Dashboard
 */
export class DashboardPage {
  readonly page: Page;
  readonly projectHealthMetrics: Locator;
  readonly criticalDelays: Locator;
  readonly resourceUtilization: Locator;
  readonly projectCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectHealthMetrics = page.locator('[data-testid="project-health"]');
    this.criticalDelays = page.locator('[data-testid="critical-delays"]');
    this.resourceUtilization = page.locator('[data-testid="resource-utilization"]');
    this.projectCard = page.locator('[data-testid="project-card"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async getProjectHealthScore(projectName: string): Promise<number | null> {
    const project = this.getProjectCard(projectName);
    const scoreElement = project.locator('[data-testid="health-score"]');
    const isVisible = await scoreElement.isVisible().catch(() => false);
    if (!isVisible) return null;
    
    const text = await scoreElement.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  async getCriticalDelayCount(): Promise<number> {
    const isVisible = await this.criticalDelays.isVisible().catch(() => false);
    if (!isVisible) return 0;
    
    const countElement = this.criticalDelays.locator('[data-testid="delay-count"]');
    const text = await countElement.textContent().catch(() => '0');
    return parseInt(text || '0', 10);
  }

  async drillDownToProject(projectName: string) {
    const project = this.getProjectCard(projectName);
    await project.click();
    await this.page.waitForLoadState('networkidle');
  }

  getProjectCard(projectName: string): Locator {
    return this.projectCard.filter({ hasText: projectName }).first();
  }

  async isDataGated(): Promise<boolean> {
    // Check if dashboard shows "pending approval" or similar gating message
    const gatingMessage = this.page.getByText(/pending|approval|gated/i);
    const isVisible = await gatingMessage.isVisible().catch(() => false);
    return isVisible;
  }
}
