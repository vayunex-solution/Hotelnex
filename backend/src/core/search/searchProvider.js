/**
 * Abstract Search Provider Interface
 */
class SearchProvider {
  /**
   * Search a specific index/table with term and optional filters
   * 
   * @param {string} indexName - e.g. 'guests', 'rooms'
   * @param {string} searchTerm 
   * @param {object} filters - tenantId, status filters
   */
  async search(indexName, searchTerm, filters = {}) {
    throw new Error('Method not implemented.');
  }
}

export default SearchProvider;
