/**
 * Abstract Base Repository Interface
 */
class BaseRepository {
  constructor() {
    this.connection = null; // Can hold scoped transaction connection
  }

  /**
   * Return a new instance of repository scoped to a specific connection
   * @param {object} connection 
   * @returns {BaseRepository}
   */
  withConnection(connection) {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.connection = connection;
    return clone;
  }

  async find(filters = {}) {
    throw new Error('Method not implemented.');
  }

  async findById(id) {
    throw new Error('Method not implemented.');
  }

  async create(data) {
    throw new Error('Method not implemented.');
  }

  async update(id, data) {
    throw new Error('Method not implemented.');
  }

  async delete(id) {
    throw new Error('Method not implemented.');
  }
}

export default BaseRepository;
