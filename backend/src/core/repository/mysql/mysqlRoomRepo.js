import MySqlBaseRepo from './mysqlBaseRepo.js';

class MySqlRoomRepo extends MySqlBaseRepo {
  constructor() {
    super('rooms');
  }

  /**
   * Room-specific query to update occupancy status
   */
  async updateStatus(roomId, status) {
    const sql = `UPDATE rooms SET status = ? WHERE id = ?`;
    await this.client.query(sql, [status, roomId]);
    return true;
  }
}

export default MySqlRoomRepo;
