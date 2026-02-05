import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Login Page
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.loginButton = page.getByRole('button', { name: /login|sign in/i });
    this.registerLink = page.getByRole('link', { name: /register|sign up/i });
    this.errorMessage = page.locator('[role="alert"]').or(page.locator('.error'));
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    // Wait for navigation after login
    await this.page.waitForURL(/^\/(?!login|register)/, { timeout: 10000 });
  }

  async isLoggedIn(): Promise<boolean> {
    // Check if we're redirected away from login page
    const url = this.page.url();
    return !url.includes('/login') && !url.includes('/register');
  }

  async getErrorMessage(): Promise<string | null> {
    const isVisible = await this.errorMessage.isVisible().catch(() => false);
    if (!isVisible) return null;
    return await this.errorMessage.textContent();
  }
}
