/**
 * Page Object Model for Pending Assignment Landing Page
 * 
 * Used for testing new_user role redirect and RBAC enforcement.
 */

import { Page, Locator } from '@playwright/test';

export class PendingAssignmentPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly pendingAlert: Locator;
  readonly requestAccessButton: Locator;
  readonly contactInfo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.getByRole('heading', { name: /welcome/i });
    this.pendingAlert = page.locator('[role="alert"]').filter({ hasText: /pending/i });
    this.requestAccessButton = page.getByRole('button', { name: /request.*access/i });
    this.contactInfo = page.locator('[data-testid="contact-info"]').or(page.getByText(/contact.*administrator/i));
  }

  /**
   * Navigate to pending assignment page
   */
  async goto() {
    await this.page.goto('/pending-assignment');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify user is on pending assignment page
   */
  async verifyOnPendingAssignmentPage(): Promise<boolean> {
    const url = this.page.url();
    const hasWelcomeMessage = await this.welcomeMessage.isVisible().catch(() => false);
    return url.includes('/pending-assignment') && hasWelcomeMessage;
  }

  /**
   * Verify user cannot access project data
   */
  async verifyBlockedFromProjects(): Promise<boolean> {
    // Try to navigate to projects
    await this.page.goto('/projects');
    await this.page.waitForLoadState('networkidle');
    
    // Should be redirected back to pending assignment
    const url = this.page.url();
    return url.includes('/pending-assignment');
  }

  /**
   * Click request access button
   */
  async requestAccess(): Promise<void> {
    if (await this.requestAccessButton.isVisible().catch(() => false)) {
      await this.requestAccessButton.click();
      await this.page.waitForTimeout(1000);
    }
  }
}
