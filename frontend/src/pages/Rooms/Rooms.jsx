import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api.js';
import { 
  Plus, Edit, Trash2, X, Loader2, BedDouble, AlertCircle, Check
} from 'lucide-react';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  // Forms state
  const [roomNumber, setRoomNumber] = useState('');
  const [category, setCategory] = useState('Standard');
  const [baseRate, setBaseRate] = useState('');
  const [status, setStatus] = useState('Available');
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // ─── Fetch Rooms ────────────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/rooms');
      setRooms(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch rooms list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // ─── Add Room Submission ───────────────────────────────────────────────────
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!roomNumber.trim()) {
      setFormError('Room number is required.');
      return;
    }
    if (!baseRate || isNaN(parseFloat(baseRate)) || parseFloat(baseRate) < 0) {
      setFormError('Base rate must be a non-negative number.');
      return;
    }

    setFormLoading(true);
    try {
      await api.post('/rooms', {
        room_number: roomNumber.trim(),
        category,
        base_rate: parseFloat(baseRate)
      });
      setSuccess('Room added successfully!');
      setAddModalOpen(false);
      fetchRooms();
      // Clear form
      setRoomNumber('');
      setCategory('Standard');
      setBaseRate('');
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to add room.');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Edit Room Setup ────────────────────────────────────────────────────────
  const openEditModal = (room) => {
    setSelectedRoom(room);
    setRoomNumber(room.room_number);
    setCategory(room.category);
    setBaseRate(room.base_rate.toString());
    setStatus(room.status);
    setFormError('');
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!roomNumber.trim()) {
      setFormError('Room number is required.');
      return;
    }
    if (!baseRate || isNaN(parseFloat(baseRate)) || parseFloat(baseRate) < 0) {
      setFormError('Base rate must be a non-negative number.');
      return;
    }

    setFormLoading(true);
    try {
      await api.put(`/rooms/${selectedRoom.id}`, {
        room_number: roomNumber.trim(),
        category,
        base_rate: parseFloat(baseRate),
        status
      });
      setSuccess('Room details updated successfully!');
      setEditModalOpen(false);
      fetchRooms();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to update room.');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Delete Room Setup ──────────────────────────────────────────────────────
  const openDeleteModal = (room) => {
    setSelectedRoom(room);
    setFormError('');
    setDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    setFormLoading(true);
    setFormError('');
    try {
      await api.delete(`/rooms/${selectedRoom.id}`);
      setSuccess('Room deleted successfully!');
      setDeleteModalOpen(false);
      fetchRooms();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to delete room.');
    } finally {
      setFormLoading(false);
    }
  };

  // Clear global notifications after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <BedDouble className="w-8 h-8 text-indigo-400" />
            Rooms Catalog
          </h1>
          <p className="text-slate-400 text-sm mt-1">Configure categories, base rates, and status properties.</p>
        </div>
        
        <button
          onClick={() => {
            setFormError('');
            setAddModalOpen(true);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          Add New Room
        </button>
      </div>

      {/* Alert Notifications */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2.5">
          <Check className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Rooms List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-slate-400 text-sm">Loading rooms data...</span>
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <BedDouble className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300">No rooms configured</h3>
          <p className="text-slate-500 text-sm mt-1">Get started by creating your first room catalog entry.</p>
        </div>
      ) : (
        <>
          {/* ── MOBILE CARD VIEW (< md) ────────────────────────────── */}
          <div className="md:hidden space-y-3">
            {rooms.map((room) => {
              let badgeBg = 'bg-slate-800 text-slate-400 border-slate-700';
              if (room.status === 'Available') badgeBg = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
              if (room.status === 'Occupied')  badgeBg = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
              if (room.status === 'Maintenance') badgeBg = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
              return (
                <div key={room.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-white text-lg">Room {room.room_number}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{room.category} · ₹{parseFloat(room.base_rate).toLocaleString('en-IN')}/night</p>
                    <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}`}>{room.status}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEditModal(room)} className="w-9 h-9 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-all" title="Edit Room">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => openDeleteModal(room)} disabled={room.status === 'Occupied'} className="w-9 h-9 bg-slate-800 border border-slate-700 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-all" title={room.status === 'Occupied' ? 'Cannot delete occupied room' : 'Delete Room'}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP TABLE VIEW (≥ md) ─────────────────────────── */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800/20">
                    <th className="px-6 py-4">Room Number</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Base Rate (INR)</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                  {rooms.map((room) => {
                    let badgeBg = 'bg-slate-800 text-slate-400 border-slate-700';
                    if (room.status === 'Available') badgeBg = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                    if (room.status === 'Occupied')  badgeBg = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                    if (room.status === 'Maintenance') badgeBg = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                    return (
                      <tr key={room.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-white text-base">{room.room_number}</td>
                        <td className="px-6 py-4 text-slate-400 font-medium">{room.category}</td>
                        <td className="px-6 py-4 font-semibold text-slate-200">₹{parseFloat(room.base_rate).toLocaleString('en-IN')}/night</td>
                        <td className="px-6 py-4">
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeBg}`}>{room.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditModal(room)} className="w-9 h-9 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-all" title="Edit Room">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => openDeleteModal(room)} disabled={room.status === 'Occupied'} className="w-9 h-9 bg-slate-800 border border-slate-700 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-all" title={room.status === 'Occupied' ? 'Cannot delete occupied room' : 'Delete Room'}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── Add Modal ──────────────────────────────────────────────────────── */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-4">Add New Room</h2>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Room Number</label>
                <input 
                  type="text" 
                  required
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. 101"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Room Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Standard">Standard</option>
                  <option value="Deluxe">Deluxe</option>
                  <option value="Suite">Suite</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Base Rate per Night (INR)</label>
                <input 
                  type="number" 
                  required
                  value={baseRate}
                  onChange={(e) => setBaseRate(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ─────────────────────────────────────────────────────── */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-4">Edit Room {selectedRoom?.room_number}</h2>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Room Number</label>
                <input 
                  type="text" 
                  required
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. 101"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Room Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Standard">Standard</option>
                  <option value="Deluxe">Deluxe</option>
                  <option value="Suite">Suite</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Base Rate per Night (INR)</label>
                <input 
                  type="number" 
                  required
                  value={baseRate}
                  onChange={(e) => setBaseRate(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Room Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={selectedRoom?.status === 'Occupied'}
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
                >
                  <option value="Available">Available</option>
                  <option value="Maintenance">Maintenance</option>
                  {selectedRoom?.status === 'Occupied' && <option value="Occupied">Occupied</option>}
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Modal ───────────────────────────────────────────────────── */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setDeleteModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-2">Delete Room</h2>
            <p className="text-slate-400 text-sm mb-4">
              Are you sure you want to permanently delete **Room {selectedRoom?.room_number}**? This action cannot be undone.
            </p>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={formLoading}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rooms;
