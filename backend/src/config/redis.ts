import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Standard Redis connection for general use
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// BullMQ-compatible Redis connection (requires maxRetriesPerRequest: null)
export const redisForBullMQ = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('❌ Redis connection error:', error);
});

redisForBullMQ.on('connect', () => {
  logger.info('✅ Redis (BullMQ) connected successfully');
});

redisForBullMQ.on('error', (error) => {
  logger.error('❌ Redis (BullMQ) connection error:', error);
});

export default redis;
