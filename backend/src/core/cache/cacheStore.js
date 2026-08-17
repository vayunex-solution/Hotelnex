/**
 * Cache Store Abstract Interface
 */
class CacheStore {
  async get(key) {
    throw new Error('Method not implemented.');
  }

  async set(key, value, ttlSeconds) {
    throw new Error('Method not implemented.');
  }

  async delete(key) {
    throw new Error('Method not implemented.');
  }

  async clear() {
    throw new Error('Method not implemented.');
  }

  async invalidateTags(tags) {
    throw new Error('Method not implemented.');
  }
}

export default CacheStore;
