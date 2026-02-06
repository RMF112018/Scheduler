import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Lazy Redis connection - only connect when needed (helps with tests)
let redisInstance: Redis | null = null;
let redisForBullMQInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true, // Don't connect immediately
    });

    redisInstance.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisInstance.on('error', (error) => {
      // Only log errors in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        logger.error('❌ Redis connection error:', error);
      }
    });
  }
  return redisInstance;
}

function getRedisForBullMQ(): Redis {
  if (!redisForBullMQInstance) {
    redisForBullMQInstance = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true, // Don't connect immediately
    });

    redisForBullMQInstance.on('connect', () => {
      logger.info('✅ Redis (BullMQ) connected successfully');
    });

    redisForBullMQInstance.on('error', (error) => {
      // Only log errors in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        logger.error('❌ Redis (BullMQ) connection error:', error);
      }
    });
  }
  return redisForBullMQInstance;
}

// Export instances (will be created lazily on first access)
export const redis = getRedis();
export const redisForBullMQ = getRedisForBullMQ();

export default redis;
