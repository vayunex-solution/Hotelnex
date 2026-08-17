/**
 * Room Maintenance Policy Rule
 * Rooms in 'Maintenance' status cannot accept new check-ins
 */
export const roomMaintenanceRule = (context, room) => {
  if (!room) {
    return { passed: false, message: 'Room entity not provided.' };
  }

  if (room.status === 'Maintenance') {
    return { passed: false, message: `Room ${room.room_number || room.id} is currently under maintenance.` };
  }

  return { passed: true, message: 'Room status check passed.' };
};
