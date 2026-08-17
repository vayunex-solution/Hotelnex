import CacheStore from '../cacheStore.js';
import InMemoryProvider from './inMemoryProvider.js';
import logger from '../../logger/logger.js';

class RedisProvider extends CacheStore {
  constructor() {
    super();
    // Falls back to InMemoryProvider as Redis is planned for future clustering support
    logger.warn('[Cache] Redis is not configured. Falling back to InMemory provider.');
    this.fallback = new InMemoryProvider();
  }

  async get(key) {
    return this.fallback.get(key);
  }

  async set(key, value, ttlSeconds, tags) {
    return this.fallback.set(key, value, ttlSeconds, tags);
  }

  async delete(key) {
    return this.fallback.delete(key);
  }

  async clear() {
    return this.fallback.clear();
  }

  async invalidateTags(tags) {
    return this.fallback.invalidateTags(tags);
  }
}

export default RedisProvider;
