import pool from '../../config/db.js';
import logger from '../logger/logger.js';

class TransactionManager {
  /**
   * Executes a callback within a database transaction boundary
   * 
   * @param {Function} callback - async function(connection)
   * @returns {*}
   */
  async runInTransaction(callback) {
    const connection = await pool.getConnection();
    try {
      logger.debug('[TransactionManager] Starting database transaction...');
      await connection.beginTransaction();
      
      const result = await callback(connection);
      
      await connection.commit();
      logger.debug('[TransactionManager] Transaction committed successfully.');
      return result;
    } catch (err) {
      logger.error('[TransactionManager] Transaction failed, rolling back. Error:', err.message);
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        logger.error('[TransactionManager] Rollback failed:', rollbackErr.message);
      }
      throw err;
    } finally {
      connection.release();
    }
  }
}

const transactionManager = new TransactionManager();
export default transactionManager;
