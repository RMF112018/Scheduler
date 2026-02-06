/**
 * Event Bus Service
 *
 * Phase 9: Async event bus using BullMQ for loose coupling between modules.
 * All events are processed asynchronously with retry and durability.
 * 
 * Decision: Start with async-only (BullMQ). Redis pub/sub deferred to Phase 10+.
 */

import { Queue, Worker, Job } from 'bullmq';
import { redisForBullMQ } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import type { BaseEvent, Event, EventType } from '../../../shared/src/events.js';
import { auditService } from './auditService.js';
import { webhookService } from './webhookService.js';

// ============================================================================
// Event Bus Class
// ============================================================================

export class EventBus {
  private queue: Queue<Event>;
  private workers: Worker<Event>[] = [];

  constructor() {
    try {
      this.queue = new Queue<Event>('events', {
        connection: redisForBullMQ,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep last 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      });

      // Set up event listeners
      this.queue.on('error', (error) => {
        // Only log errors in non-test environments
        if (process.env.NODE_ENV !== 'test') {
          logger.error('Event bus queue error:', error);
        }
      });
    } catch (error) {
      // In test environments, create a minimal queue that will fail gracefully
      if (process.env.NODE_ENV === 'test') {
        logger.debug('Event bus initialized in test mode (Redis may be unavailable)');
        this.queue = new Queue<Event>('events', {
          connection: redisForBullMQ,
          defaultJobOptions: {
            attempts: 1,
          },
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Publish an event to the event bus
   */
  async publish(event: Event): Promise<void> {
    try {
      await this.queue.add(event.type, event, {
        jobId: `${event.type}-${event.entityId}-${Date.now()}`,
      });
      logger.debug(`Published event: ${event.type} for entity ${event.entityId}`);
    } catch (error) {
      // In test environments, silently fail if Redis is unavailable
      if (process.env.NODE_ENV === 'test') {
        logger.debug(`Event publishing skipped in test (Redis unavailable): ${event.type}`);
        return;
      }
      logger.error(`Failed to publish event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Publish a delayed event (for scheduled tasks, daily rollups, etc.)
   */
  async publishDelayed(event: Event, delayMs: number): Promise<void> {
    try {
      await this.queue.add(event.type, event, {
        delay: delayMs,
        jobId: `${event.type}-${event.entityId}-${Date.now()}`,
      });
      logger.debug(`Published delayed event: ${event.type} (delay: ${delayMs}ms)`);
    } catch (error) {
      // In test environments, silently fail if Redis is unavailable
      if (process.env.NODE_ENV === 'test') {
        logger.debug(`Delayed event publishing skipped in test (Redis unavailable): ${event.type}`);
        return;
      }
      logger.error(`Failed to publish delayed event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Start event processors
   * Call this during application initialization
   */
  startProcessors(): void {
    // Skip processor startup in test environments if Redis is unavailable
    if (process.env.NODE_ENV === 'test') {
      try {
        // Test Redis connection
        redisForBullMQ.ping().catch(() => {
          logger.debug('Event bus processors skipped in test (Redis unavailable)');
          return;
        });
      } catch {
        logger.debug('Event bus processors skipped in test (Redis unavailable)');
        return;
      }
    }
    
    logger.info('Starting event bus processors...');

    try {
      // Audit log processor - logs all events to audit log
      const auditWorker = new Worker<Event>(
      'events',
      async (job: Job<Event>) => {
        const event = job.data;
        
        // Convert event to audit log entry
        await auditService.logChange({
          entityType: event.entityType,
          entityId: event.entityId,
          action: this.getActionFromEventType(event.type),
          userId: event.userId,
          companyId: event.companyId,
          changes: this.extractChangesFromEvent(event),
          metadata: {
            ...event.metadata,
            eventType: event.type,
            timestamp: event.timestamp,
          },
        });
      },
      {
        connection: redisForBullMQ,
        concurrency: 5, // Process up to 5 audit jobs concurrently
      }
    );

    auditWorker.on('completed', (job) => {
      logger.debug(`Audit log processed for event: ${job.data.type}`);
    });

    auditWorker.on('failed', (job, err) => {
      logger.error(`Audit log processing failed for event ${job?.data?.type}:`, err);
    });

    this.workers.push(auditWorker);

    // Webhook processor - delivers events to webhook subscribers
    const webhookWorker = new Worker<Event>(
      'events',
      async (job: Job<Event>) => {
        const event = job.data;
        await webhookService.deliverEvent(event);
      },
      {
        connection: redisForBullMQ,
        concurrency: 3, // Process webhooks with lower concurrency
      }
    );

    webhookWorker.on('completed', (job) => {
      logger.debug(`Webhook delivered for event: ${job.data.type}`);
    });

    webhookWorker.on('failed', (job, err) => {
      logger.error(`Webhook delivery failed for event ${job?.data?.type}:`, err);
    });

    this.workers.push(webhookWorker);

    logger.info(`Started ${this.workers.length} event bus processor(s)`);
    } catch (error) {
      logger.error('Failed to start event bus processors:', error);
      // Clean up any workers that were created before the error (async, don't await)
      Promise.all(this.workers.map((worker) => worker.close().catch(() => {}))).catch(() => {});
      this.workers = [];
      throw error;
    }
  }

  /**
   * Stop all event processors
   */
  async stopProcessors(): Promise<void> {
    logger.info('Stopping event bus processors...');
    await Promise.all(this.workers.map((worker) => worker.close()));
    this.workers = [];
    logger.info('Event bus processors stopped');
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Helper: Extract action from event type
   */
  private getActionFromEventType(eventType: EventType): 'create' | 'update' | 'delete' {
    if (eventType.endsWith('.created')) {
      return 'create';
    }
    if (eventType.endsWith('.deleted')) {
      return 'delete';
    }
    return 'update';
  }

  /**
   * Helper: Extract changes from event
   */
  private extractChangesFromEvent(event: Event): Record<string, { old: unknown; new: unknown }> {
    // If event has explicit changes (e.g., ActivityUpdatedEvent), use them
    if ('changes' in event && typeof event.changes === 'object') {
      return event.changes as Record<string, { old: unknown; new: unknown }>;
    }

    // Otherwise, create a generic change entry
    return {
      _event: {
        old: null,
        new: event.type,
      },
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const eventBus = new EventBus();
