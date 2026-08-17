import dotenv from 'dotenv';
dotenv.config();

class ConfigService {
  constructor() {
    this.env = process.env;
  }

  /**
   * Get an environment variable value with optional default fallback
   * @param {string} key 
   * @param {*} defaultValue 
   * @returns {*}
   */
  get(key, defaultValue = null) {
    const value = this.env[key];
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    
    // Auto-parse booleans
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Auto-parse numbers
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      return parseFloat(value);
    }
    
    return value;
  }

  /**
   * Resolves a setting from the property_settings database table
   * @param {object} pool - mysql connection pool or transaction connection
   * @param {number} propertyId 
   * @param {string} category 
   * @param {string} key 
   * @param {*} defaultValue 
   * @returns {Promise<*>}
   */
  async getPropertySetting(pool, propertyId, category, key, defaultValue = null) {
    try {
      const [rows] = await pool.query(
        `SELECT setting_value, data_type FROM property_settings 
         WHERE property_id = ? AND category = ? AND setting_key = ? LIMIT 1`,
        [propertyId, category, key]
      );

      if (!rows || rows.length === 0) {
        return defaultValue;
      }

      const { setting_value, data_type } = rows[0];
      return this.castValue(setting_value, data_type);
    } catch (err) {
      console.error(`[ConfigService] Error resolving property setting ${category}.${key}:`, err.message);
      return defaultValue;
    }
  }

  /**
   * Cast raw string value from database to standard Types
   */
  castValue(value, dataType) {
    if (value === null || value === undefined) return null;
    switch (dataType) {
      case 'boolean':
        return value === 'true' || value === '1' || value === 1;
      case 'int':
        return parseInt(value, 10);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      case 'encrypted':
        // Future: Decrypt value using encryption utility
        return value;
      default:
        return value;
    }
  }
}

const configService = new ConfigService();
export default configService;
