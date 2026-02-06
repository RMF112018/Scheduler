import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Approval Workflow Page
 */
export class ApprovalPage {
  readonly page: Page;
  readonly pendingApprovals: Locator;
  readonly approvalCard: Locator;
  readonly approveButton: Locator;
  readonly rejectButton: Locator;
  readonly attachmentReview: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pendingApprovals = page.locator('[data-testid="pending-approvals"]');
    this.approvalCard = page.locator('[data-testid="approval-card"]');
    this.approveButton = page.getByRole('button', { name: /approve/i });
    this.rejectButton = page.getByRole('button', { name: /reject/i });
    this.attachmentReview = page.locator('[data-testid="attachment-review"]');
  }

  async goto(projectId?: string) {
    const url = projectId
      ? `/projects/${projectId}/approvals`
      : '/approvals';
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  async getPendingApprovalCount(): Promise<number> {
    const isVisible = await this.pendingApprovals.isVisible().catch(() => false);
    if (!isVisible) return 0;
    
    const countElement = this.pendingApprovals.locator('[data-testid="count"]');
    const text = await countElement.textContent().catch(() => '0');
    return parseInt(text || '0', 10);
  }

  async reviewApproval(lookaheadName: string) {
    const approval = this.getApprovalCard(lookaheadName);
    await approval.click();
    await this.page.waitForLoadState('networkidle');
  }

  async approveLookahead(lookaheadName: string, reason?: string) {
    await this.reviewApproval(lookaheadName);
    
    if (reason) {
      await this.page.getByLabel(/reason|comment/i).fill(reason);
    }
    
    await this.approveButton.click();
    await this.page.waitForTimeout(1000);
  }

  async rejectLookahead(lookaheadName: string, reason: string) {
    await this.reviewApproval(lookaheadName);
    
    await this.page.getByLabel(/reason|comment/i).fill(reason);
    await this.rejectButton.click();
    await this.page.waitForTimeout(1000);
  }

  async reviewAttachment(attachmentName: string) {
    const attachment = this.attachmentReview.getByText(attachmentName).first();
    await attachment.click();
    await this.page.waitForTimeout(500);
  }

  async approveAttachment(attachmentName: string) {
    await this.reviewAttachment(attachmentName);
    await this.page.getByRole('button', { name: /approve attachment/i }).click();
    await this.page.waitForTimeout(500);
  }

  async rejectAttachment(attachmentName: string, reason: string) {
    await this.reviewAttachment(attachmentName);
    await this.page.getByRole('button', { name: /reject attachment/i }).click();
    await this.page.waitForSelector('[role="dialog"]');
    await this.page.getByLabel(/reason/i).fill(reason);
    await this.page.getByRole('button', { name: /confirm reject/i }).click();
    await this.page.waitForTimeout(500);
  }

  getApprovalCard(lookaheadName: string): Locator {
    return this.approvalCard.filter({ hasText: lookaheadName }).first();
  }

  async hasPendingAttachments(lookaheadName: string): Promise<boolean> {
    const approval = this.getApprovalCard(lookaheadName);
    const attachmentBadge = approval.locator('[data-testid="attachment-badge"]');
    const isVisible = await attachmentBadge.isVisible().catch(() => false);
    return isVisible;
  }
}
