import CacheStore from '../cacheStore.js';
import logger from '../../logger/logger.js';

class InMemoryProvider extends CacheStore {
  constructor() {
    super();
    this.store = new Map(); // key -> { value, expiresAt, tags: [] }
    this.tagMap = new Map(); // tag -> Set of keys
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key, value, ttlSeconds = 300, tags = []) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt, tags });

    // Track key mapping under tags for quick invalidation
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        if (!this.tagMap.has(tag)) {
          this.tagMap.set(tag, new Set());
        }
        this.tagMap.get(tag).add(key);
      }
    }
    
    logger.debug(`[Cache] Set key: ${key} | TTL: ${ttlSeconds}s | Tags: ${tags.join(', ')}`);
    return true;
  }

  async delete(key) {
    const item = this.store.get(key);
    if (item) {
      // Remove references in tagMap
      if (item.tags) {
        for (const tag of item.tags) {
          const keys = this.tagMap.get(tag);
          if (keys) {
            keys.delete(key);
            if (keys.size === 0) this.tagMap.delete(tag);
          }
        }
      }
      this.store.delete(key);
    }
    return true;
  }

  async clear() {
    this.store.clear();
    this.tagMap.clear();
    return true;
  }

  async invalidateTags(tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    for (const tag of tagArray) {
      const keys = this.tagMap.get(tag);
      if (keys) {
        logger.info(`[Cache] Invalidating tag: ${tag} (${keys.size} keys)`);
        for (const key of Array.from(keys)) {
          this.delete(key);
        }
        this.tagMap.delete(tag);
      }
    }
    return true;
  }
}

export default InMemoryProvider;
