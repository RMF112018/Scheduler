/**
 * Event Bus Test Utilities
 *
 * Phase 9: Test helpers for event bus integration testing.
 */

import { Queue, Worker } from 'bullmq';
import { redis } from '../../../src/config/redis.js';
import type { Event, BaseEvent } from '../../../shared/src/events.js';

/**
 * Create a test event bus queue
 */
export function createTestEventQueue(): Queue<Event> {
  return new Queue<Event>('test-events', {
    connection: redis,
  });
}

/**
 * Wait for an event to be processed
 * Polls the queue until the event is found or timeout is reached
 */
export async function waitForEvent(
  queue: Queue<Event>,
  eventType: string,
  entityId?: string,
  timeout = 5000
): Promise<Event | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const jobs = await queue.getJobs(['completed', 'active', 'waiting']);
    
    for (const job of jobs) {
      const event = job.data as Event;
      if (event.type === eventType) {
        if (!entityId || event.entityId === entityId) {
          return event;
        }
      }
    }
    
    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  return null;
}

/**
 * Get all events of a specific type from the queue
 */
export async function getEventsByType(
  queue: Queue<Event>,
  eventType: string
): Promise<Event[]> {
  const jobs = await queue.getJobs(['completed', 'active', 'waiting', 'failed']);
  return jobs
    .map((job) => job.data as Event)
    .filter((event) => event.type === eventType);
}

/**
 * Clear all events from the test queue
 */
export async function clearTestQueue(queue: Queue<Event>): Promise<void> {
  await queue.obliterate({ force: true });
}

/**
 * Create a test event worker that collects events
 */
export class TestEventCollector {
  private events: Event[] = [];
  private worker: Worker<Event>;

  constructor(queueName: string = 'test-events') {
    this.worker = new Worker<Event>(
      queueName,
      async (job) => {
        this.events.push(job.data);
      },
      {
        connection: redis,
        concurrency: 1,
      }
    );
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  getEventsByType(eventType: string): Event[] {
    return this.events.filter((e) => e.type === eventType);
  }

  clear(): void {
    this.events = [];
  }

  async close(): Promise<void> {
    await this.worker.close();
  }

  async waitForEvent(eventType: string, timeout = 5000): Promise<Event | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const event = this.events.find((e) => e.type === eventType);
      if (event) {
        return event;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    
    return null;
  }
}
