import configService from '../config/configService.js';
import logger from '../logger/logger.js';

class RepositoryFactory {
  constructor() {
    this.dbType = configService.get('DB_TYPE', 'mysql').toLowerCase();
    this.repositories = new Map(); // modelName -> Class
  }

  /**
   * Register a database-specific repository class
   */
  register(modelName, dbType, repositoryClass) {
    if (!this.repositories.has(modelName)) {
      this.repositories.set(modelName, {});
    }
    this.repositories.get(modelName)[dbType] = repositoryClass;
    logger.debug(`[RepositoryFactory] Registered repository for ${modelName} (${dbType})`);
  }

  /**
   * Resolves repository instance for the active database engine
   */
  resolve(modelName) {
    const registry = this.repositories.get(modelName);
    if (!registry) {
      throw new Error(`[RepositoryFactory] No repository registry found for model: ${modelName}`);
    }

    const RepoClass = registry[this.dbType] || registry['mysql']; // default fallback to mysql
    if (!RepoClass) {
      throw new Error(`[RepositoryFactory] No repository class configured for model: ${modelName} with DB type: ${this.dbType}`);
    }

    return new RepoClass();
  }
}

const repositoryFactory = new RepositoryFactory();
export default repositoryFactory;
