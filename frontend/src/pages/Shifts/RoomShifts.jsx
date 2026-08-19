import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';
import RoomShiftModal from '../../components/RoomShiftModal.jsx';
import {
  ArrowRightLeft, BedDouble, Search, RefreshCw, Loader2,
  AlertCircle, Users, Wrench, ShieldCheck, Clock, Phone,
  IndianRupee, Calendar, CheckCircle2, ChevronRight, Filter,
  History, ArrowUpRight, Check, FileText
} from 'lucide-react';

const RoomShifts = () => {
  const [activeTab, setActiveTab] = useState('occupied'); // 'occupied' or 'logs'
  const [occupiedRooms, setOccupiedRooms] = useState([]);
  const [transferLogs, setTransferLogs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState({ totalRooms: 0, available: 0, occupied: 0, maintenance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [selectedBookingForShift, setSelectedBookingForShift] = useState(null);
  const [selectedRoomForShift, setSelectedRoomForShift] = useState(null);

  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [activeRes, logsRes, roomsRes, statsRes] = await Promise.allSettled([
        api.get('/bookings/active'),
        api.get('/bookings/transfers/all'),
        api.get('/rooms'),
        api.get('/bookings/stats')
      ]);

      if (activeRes.status === 'fulfilled' && activeRes.value.data?.bookings) {
        setOccupiedRooms(activeRes.value.data.bookings);
      }
      if (logsRes.status === 'fulfilled' && logsRes.value.data?.transfers) {
        setTransferLogs(logsRes.value.data.transfers);
      }
      if (roomsRes.status === 'fulfilled' && roomsRes.value.data?.rooms) {
        setRooms(roomsRes.value.data.rooms);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.data?.stats) {
        setStats(statsRes.value.data.stats);
      }
    } catch (err) {
      console.error('Failed to load room shifts data', err);
      setError('Failed to load room shifts. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleOpenShift = (booking) => {
    const roomObj = rooms.find(r => r.id === booking.room_id) || {
      id: booking.room_id,
      room_number: booking.room_number,
      category: booking.room_category,
      base_rate: booking.room_rate
    };
    setSelectedBookingForShift(booking);
    setSelectedRoomForShift(roomObj);
    setShiftModalOpen(true);
  };

  const handleShiftSuccess = () => {
    fetchAllData();
  };

  // Filter occupied rooms
  const filteredOccupied = occupiedRooms.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      b.room_number?.toString().toLowerCase().includes(q) ||
      b.guest_name?.toLowerCase().includes(q) ||
      b.guest_phone?.toLowerCase().includes(q) ||
      b.room_category?.toLowerCase().includes(q)
    );
  });

  // Filter transfer logs
  const filteredLogs = transferLogs.filter(log => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      log.from_room_number?.toString().toLowerCase().includes(q) ||
      log.to_room_number?.toString().toLowerCase().includes(q) ||
      log.guest_name?.toLowerCase().includes(q) ||
      log.reason_category?.toLowerCase().includes(q) ||
      log.transferred_by_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Room Shifts &amp; Transfers</h1>
          </div>
          <p className="text-slate-400 text-sm ml-0.5">
            Instant guest relocation · 12 Maintenance issue categories · Audit history logs
          </p>
        </div>

        <button
          onClick={fetchAllData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all self-start shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── KPI METRICS ROW ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/70 border border-rose-500/20 rounded-2xl p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Occupied (Eligible to Shift)</p>
          <p className="text-2xl sm:text-3xl font-black text-rose-400">{loading ? '…' : occupiedRooms.length}</p>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">Currently in-house</p>
        </div>

        <div className="bg-slate-900/70 border border-indigo-500/20 rounded-2xl p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Available Rooms</p>
          <p className="text-2xl sm:text-3xl font-black text-indigo-400">{loading ? '…' : (stats.available || 0)}</p>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">Target destinations</p>
        </div>

        <div className="bg-slate-900/70 border border-amber-500/20 rounded-2xl p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">In Maintenance</p>
          <p className="text-2xl sm:text-3xl font-black text-amber-400">{loading ? '…' : (stats.maintenance || 0)}</p>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">Locked for repairs</p>
        </div>

        <div className="bg-slate-900/70 border border-emerald-500/20 rounded-2xl p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Shifts Recorded</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">{loading ? '…' : transferLogs.length}</p>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">Permanent audit logs</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── TABS & SEARCH CONTROLS ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('occupied')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'occupied'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <BedDouble className="w-4 h-4" />
            Occupied Rooms ({occupiedRooms.length})
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Transfer Logs ({transferLogs.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'occupied' ? "Search room or guest..." : "Search transfer logs..."}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* ── TAB 1: OCCUPIED ROOMS (INSTANT SHIFT) ─────────────────────────── */}
      {activeTab === 'occupied' && (
        <>
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Loading occupied rooms...</p>
            </div>
          ) : filteredOccupied.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">No Occupied Rooms Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery ? "No occupied rooms match your search query." : "All rooms are currently vacant. Check in a guest from the Dashboard to perform a shift."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOccupied.map((booking) => {
                const nights = Math.max(1, Math.ceil(Math.abs(new Date() - new Date(booking.check_in_time)) / 86400000));
                return (
                  <div
                    key={booking.id}
                    className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 space-y-4 shadow-lg transition-all duration-200 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col items-center justify-center shrink-0">
                            <span className="text-base font-black text-rose-400">#{booking.room_number}</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase">{booking.room_category}</span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-white truncate">{booking.guest_name}</h3>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {booking.guest_phone}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                          Occupied
                        </span>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                        <div>
                          <p className="text-slate-500 font-medium">Daily Rate</p>
                          <p className="text-white font-bold">₹{parseFloat(booking.room_rate).toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium">Stay Duration</p>
                          <p className="text-indigo-400 font-bold">{nights} night(s) so far</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium">Checked In</p>
                          <p className="text-slate-300 font-semibold">{new Date(booking.check_in_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium">Advance Paid</p>
                          <p className="text-emerald-400 font-bold">₹{parseFloat(booking.advance_paid).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenShift(booking)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer group-hover:scale-[1.01]"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Shift Room Now
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: TRANSFER LOGS / HISTORY ────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Loading transfer logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                <History className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">No Transfer Logs Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery ? "No transfer logs match your search." : "When you shift an in-house guest to another room, the complete audit record will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/40 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-5 py-4">Timestamp</th>
                    <th className="px-5 py-4">Guest</th>
                    <th className="px-5 py-4">Room Transfer</th>
                    <th className="px-5 py-4">Issue / Reason</th>
                    <th className="px-5 py-4">Rate Policy</th>
                    <th className="px-5 py-4 text-right">Staff / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Timestamp */}
                      <td className="px-5 py-4 text-slate-400 font-mono">
                        {new Date(log.transferred_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>

                      {/* Guest */}
                      <td className="px-5 py-4">
                        <p className="font-bold text-white text-sm">{log.guest_name}</p>
                        {log.guest_phone && <p className="text-[11px] text-slate-500">{log.guest_phone}</p>}
                      </td>

                      {/* From -> To */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 font-bold">
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400">
                            Room {log.from_room_number} <span className="text-[10px] font-normal text-slate-400">({log.from_room_category})</span>
                          </span>
                          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                            Room {log.to_room_number} <span className="text-[10px] font-normal text-slate-400">({log.to_room_category})</span>
                          </span>
                        </div>
                        {log.mark_old_room_maintenance ? (
                          <span className="inline-block mt-1 text-[9px] font-semibold text-amber-400">
                            ⚠ Old Room moved to Maintenance
                          </span>
                        ) : null}
                      </td>

                      {/* Reason */}
                      <td className="px-5 py-4 max-w-xs">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-[10px]">
                          {log.reason_category}
                        </span>
                        {log.reason_details && (
                          <p className="text-[11px] text-slate-400 mt-1 italic truncate">
                            "{log.reason_details}"
                          </p>
                        )}
                      </td>

                      {/* Rate Policy */}
                      <td className="px-5 py-4">
                        {log.rate_policy === 'apply_new' ? (
                          <div>
                            <span className="font-bold text-amber-400">Upgrade Rate</span>
                            <p className="text-[10px] text-slate-500">₹{parseFloat(log.new_room_rate).toLocaleString('en-IN')}/nt</p>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-300">Complimentary</span>
                            <p className="text-[10px] text-slate-500">Same rate (₹{parseFloat(log.old_room_rate).toLocaleString('en-IN')})</p>
                          </div>
                        )}
                      </td>

                      {/* Staff */}
                      <td className="px-5 py-4 text-right">
                        <span className="text-slate-300 font-semibold">{log.transferred_by_name || 'Staff'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ROOM SHIFT MODAL ────────────────────────────────────────────────── */}
      <RoomShiftModal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        booking={selectedBookingForShift}
        currentRoom={selectedRoomForShift}
        onSuccess={handleShiftSuccess}
      />
    </div>
  );
};

export default RoomShifts;
