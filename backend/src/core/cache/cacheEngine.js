import configService from '../config/configService.js';
import InMemoryProvider from './providers/inMemoryProvider.js';
import RedisProvider from './providers/redisProvider.js';
import logger from '../logger/logger.js';

class CacheEngine {
  constructor() {
    const providerType = configService.get('CACHE_PROVIDER', 'in-memory').toLowerCase();
    
    if (providerType === 'redis') {
      this.provider = new RedisProvider();
    } else {
      logger.info('[CacheEngine] Initialized with InMemory Cache Provider.');
      this.provider = new InMemoryProvider();
    }
  }

  async get(key) {
    return this.provider.get(key);
  }

  async set(key, value, ttlSeconds, tags) {
    return this.provider.set(key, value, ttlSeconds, tags);
  }

  async delete(key) {
    return this.provider.delete(key);
  }

  async clear() {
    return this.provider.clear();
  }

  async invalidateTags(tags) {
    return this.provider.invalidateTags(tags);
  }
}

const cacheEngine = new CacheEngine();
export default cacheEngine;
