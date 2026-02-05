/**
 * Module Configuration
 *
 * Phase 9: Feature flags for enabling/disabling modules and partner integrations.
 * All modules are enabled by default in development, but can be disabled via environment variables.
 */

export interface ModuleConfig {
  // Core modules
  ENABLE_COST_MODULE: boolean;
  ENABLE_DOCS_MODULE: boolean;
  ENABLE_RFI_MODULE: boolean;
  ENABLE_DAILY_LOGS_MODULE: boolean;
  ENABLE_FIELD_MODULE: boolean;

  // Partner integrations
  ENABLE_PROCORE_WEBHOOKS: boolean;
  ENABLE_AUTODESK_WEBHOOKS: boolean;
  ENABLE_QUICKBOOKS_WEBHOOKS: boolean;
  ENABLE_BLUEBEAM_WEBHOOKS: boolean;
  PARTNER_WEBHOOKS: boolean; // Master switch for all partner webhooks

  // Webhook configuration
  WEBHOOK_SECRET: string;
  WEBHOOK_RETRY_ATTEMPTS: number;
  WEBHOOK_TIMEOUT_MS: number;
}

/**
 * Get module configuration from environment variables
 */
export const moduleConfig: ModuleConfig = {
  // Core modules - default to true in development, false in production
  ENABLE_COST_MODULE: process.env.ENABLE_COST_MODULE === 'true' || 
    (process.env.NODE_ENV !== 'production' && process.env.ENABLE_COST_MODULE !== 'false'),
  ENABLE_DOCS_MODULE: process.env.ENABLE_DOCS_MODULE === 'true' || 
    (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DOCS_MODULE !== 'false'),
  ENABLE_RFI_MODULE: process.env.ENABLE_RFI_MODULE === 'true' || 
    (process.env.NODE_ENV !== 'production' && process.env.ENABLE_RFI_MODULE !== 'false'),
  ENABLE_DAILY_LOGS_MODULE: process.env.ENABLE_DAILY_LOGS_MODULE === 'true' || 
    (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DAILY_LOGS_MODULE !== 'false'),
  ENABLE_FIELD_MODULE: process.env.ENABLE_FIELD_MODULE === 'true' || 
    (process.env.NODE_ENV !== 'production' && process.env.ENABLE_FIELD_MODULE !== 'false'),

  // Partner integrations - default to false
  ENABLE_PROCORE_WEBHOOKS: process.env.ENABLE_PROCORE_WEBHOOKS === 'true',
  ENABLE_AUTODESK_WEBHOOKS: process.env.ENABLE_AUTODESK_WEBHOOKS === 'true',
  ENABLE_QUICKBOOKS_WEBHOOKS: process.env.ENABLE_QUICKBOOKS_WEBHOOKS === 'true',
  ENABLE_BLUEBEAM_WEBHOOKS: process.env.ENABLE_BLUEBEAM_WEBHOOKS === 'true',
  PARTNER_WEBHOOKS: process.env.PARTNER_WEBHOOKS === 'true',

  // Webhook configuration
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
  WEBHOOK_RETRY_ATTEMPTS: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10),
  WEBHOOK_TIMEOUT_MS: parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000', 10),
};

/**
 * Check if a module is enabled
 */
export function isModuleEnabled(moduleName: keyof ModuleConfig): boolean {
  return moduleConfig[moduleName] === true;
}

/**
 * Get module status for all modules
 */
export function getModuleStatus(): Record<string, boolean> {
  return {
    cost: moduleConfig.ENABLE_COST_MODULE,
    documents: moduleConfig.ENABLE_DOCS_MODULE,
    rfi: moduleConfig.ENABLE_RFI_MODULE,
    dailyLogs: moduleConfig.ENABLE_DAILY_LOGS_MODULE,
    field: moduleConfig.ENABLE_FIELD_MODULE,
    procoreWebhooks: moduleConfig.ENABLE_PROCORE_WEBHOOKS,
    autodeskWebhooks: moduleConfig.ENABLE_AUTODESK_WEBHOOKS,
    quickbooksWebhooks: moduleConfig.ENABLE_QUICKBOOKS_WEBHOOKS,
    bluebeamWebhooks: moduleConfig.ENABLE_BLUEBEAM_WEBHOOKS,
    partnerWebhooks: moduleConfig.PARTNER_WEBHOOKS,
  };
}
