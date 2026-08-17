import BaseRepository from '../baseRepository.js';
import pool from '../../../config/db.js';

class MySqlBaseRepo extends BaseRepository {
  constructor(tableName) {
    super();
    this.tableName = tableName;
  }

  /**
   * Get active query client (connection from transaction or global pool)
   */
  get client() {
    return this.connection || pool;
  }

  async find(filters = {}) {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];
    const filterKeys = Object.keys(filters);

    if (filterKeys.length > 0) {
      const conditions = filterKeys.map(key => {
        params.push(filters[key]);
        return `\`${key}\` = ?`;
      });
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    const [rows] = await this.client.query(sql, params);
    return rows;
  }

  async findById(id) {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ? LIMIT 1`;
    const [rows] = await this.client.query(sql, [id]);
    return rows[0] || null;
  }

  async create(data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const fieldsList = keys.map(k => `\`${k}\``).join(', ');
    const sql = `INSERT INTO ${this.tableName} (${fieldsList}) VALUES (${placeholders})`;
    
    const [result] = await this.client.query(sql, Object.values(data));
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    const keys = Object.keys(data);
    const sets = keys.map(key => `\`${key}\` = ?`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${sets} WHERE id = ?`;
    
    await this.client.query(sql, [...Object.values(data), id]);
    return this.findById(id);
  }

  async delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.client.query(sql, [id]);
    return true;
  }
}

export default MySqlBaseRepo;
