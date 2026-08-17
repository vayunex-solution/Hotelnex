import SearchProvider from '../searchProvider.js';
import pool from '../../../config/db.js';
import logger from '../../logger/logger.js';

class SqlSearchProvider extends SearchProvider {
  constructor() {
    super();
    this.name = 'SQLSearchProvider';
  }

  async search(indexName, searchTerm, filters = {}) {
    logger.info(`[SqlSearch] Searching ${indexName} for term: "${searchTerm}"`);
    
    let sql = '';
    const params = [];

    // Guest search fallback
    if (indexName === 'guests') {
      const term = `%${searchTerm.trim()}%`;
      const tenantId = filters.tenantId || null;
      const propertyId = filters.propertyId || null;

      sql = `SELECT * FROM guests WHERE (full_name LIKE ? OR phone_number LIKE ?)`;
      params.push(term, term);

      if (tenantId) {
        sql += ` AND tenant_id = ?`;
        params.push(tenantId);
      }
      if (propertyId) {
        sql += ` AND hotel_id = ?`;
        params.push(propertyId);
      }

      sql += ` LIMIT 50`;
      const [rows] = await pool.query(sql, params);
      return rows;
    }

    // Default empty response
    return [];
  }
}

export default SqlSearchProvider;
