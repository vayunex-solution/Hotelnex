import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import {
  BedDouble, Search, X, Loader2, Wrench, Check,
  DollarSign, Calendar, Phone, MapPin, User, FileText,
  AlertCircle, RefreshCw, TrendingUp, Users, ArrowDownCircle,
  ArrowUpCircle, ShieldCheck, IndianRupee, LogIn, LogOut,
  Clock, Zap, ChevronRight, Image as ImageIcon
} from 'lucide-react';

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, color, loading, onClick }) => {
  const colors = {
    emerald: 'border-emerald-500/25 bg-emerald-500/5  hover:border-emerald-500/50 hover:bg-emerald-500/10',
    rose:    'border-rose-500/25    bg-rose-500/5     hover:border-rose-500/50    hover:bg-rose-500/10',
    amber:   'border-amber-500/25   bg-amber-500/5    hover:border-amber-500/50   hover:bg-amber-500/10',
    indigo:  'border-indigo-500/25  bg-indigo-500/5   hover:border-indigo-500/50  hover:bg-indigo-500/10',
    violet:  'border-violet-500/25  bg-violet-500/5   hover:border-violet-500/50  hover:bg-violet-500/10',
  };
  const iconColors = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    rose:    'text-rose-400    bg-rose-500/10',
    amber:   'text-amber-400   bg-amber-500/10',
    indigo:  'text-indigo-400  bg-indigo-500/10',
    violet:  'text-violet-400  bg-violet-500/10',
  };
  const arrowColors = {
    emerald: 'text-emerald-400',
    rose:    'text-rose-400',
    amber:   'text-amber-400',
    indigo:  'text-indigo-400',
    violet:  'text-violet-400',
  };
  return (
    <button
      onClick={onClick}
      className={`group relative border rounded-2xl p-4 sm:p-5 overflow-hidden text-left w-full
        cursor-pointer hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]
        transition-all duration-200 ease-out ${colors[color]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
          <p className="text-2xl sm:text-3xl font-black text-white leading-none">
            {loading ? <span className="inline-block w-8 h-7 bg-slate-700/60 rounded animate-pulse" /> : value}
          </p>
          {sub && <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5 font-medium">{sub}</p>}
        </div>
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColors[color]}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      {/* Hover arrow indicator */}
      <div className={`absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${arrowColors[color]}`}>
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
};

// ─── Room Card ───────────────────────────────────────────────────────────────
const RoomCard = ({ room, onClick }) => {
  const isAvail = room.status === 'Available';
  const isOcc   = room.status === 'Occupied';
  const isMaint = room.status === 'Maintenance';

  const cfg = isAvail
    ? { border: 'border-emerald-500/20 hover:border-emerald-500/50', dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', glow: 'hover:shadow-emerald-500/5' }
    : isOcc
    ? { border: 'border-rose-500/20 hover:border-rose-500/50',       dot: 'bg-rose-500',    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',         glow: 'hover:shadow-rose-500/5' }
    : { border: 'border-amber-500/20 hover:border-amber-500/50',     dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',       glow: 'hover:shadow-amber-500/5' };

  return (
    <button
      onClick={() => onClick(room)}
      className={`group relative bg-slate-900 border ${cfg.border} rounded-2xl p-4 sm:p-5 cursor-pointer hover:scale-[1.02] hover:shadow-xl ${cfg.glow} transition-all duration-200 text-left w-full flex flex-col justify-between`}
      style={{ minHeight: '120px' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{room.category}</span>
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${cfg.badge}`}>
          {room.status}
        </span>
      </div>

      {/* Room number */}
      <div>
        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none group-hover:text-indigo-300 transition-colors">
          {room.room_number}
        </h3>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/80">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Rate</span>
        <span className="text-xs font-bold text-slate-300">₹{parseFloat(room.base_rate).toLocaleString('en-IN')}/night</span>
      </div>

      {/* Status dot pulse for occupied */}
      {isOcc && (
        <span className="absolute top-3 right-3 w-2 h-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
        </span>
      )}
    </button>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const Dashboard = () => {
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState({ available: 0, occupied: 0, maintenance: 0, totalRooms: 0, todayCheckins: 0, todayCheckouts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedRoom, setSelectedRoom]     = useState(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [activeTab, setActiveTab]           = useState('checkin');
  const [drawerLoading, setDrawerLoading]   = useState(false);
  const [drawerError, setDrawerError]       = useState('');
  const [drawerSuccess, setDrawerSuccess]   = useState('');

  const [searchPhone, setSearchPhone]       = useState('');
  const [searchingGuest, setSearchingGuest] = useState(false);
  const [guestFound, setGuestFound]         = useState(null);

  const [fullName, setFullName]             = useState('');
  const [guestPhone, setGuestPhone]         = useState('');
  const [guestAddress, setGuestAddress]     = useState('');
  const [guestPhoto, setGuestPhoto]         = useState(null);
  const [idFront, setIdFront]               = useState(null);
  const [idBack, setIdBack]                 = useState(null);

  const [expectedCheckout, setExpectedCheckout] = useState('');
  const [roomRate, setRoomRate]                 = useState('');
  const [advancePaid, setAdvancePaid]           = useState('0');
  const [activeBooking, setActiveBooking]       = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [roomsRes, statsRes] = await Promise.all([api.get('/rooms'), api.get('/bookings/stats')]);
      setRooms(roomsRes.data.data || []);
      setStats(statsRes.data.stats || { available: 0, occupied: 0, maintenance: 0, totalRooms: 0, todayCheckins: 0, todayCheckouts: 0 });
    } catch (err) {
      console.error(err);
      setError('Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  // ── Drawer open ───────────────────────────────────────────────────────────
  const handleRoomClick = async (room) => {
    setSelectedRoom(room);
    setDrawerOpen(true);
    setDrawerError('');
    setDrawerSuccess('');
    setRoomRate(room.base_rate.toString());
    setExpectedCheckout('');
    setAdvancePaid('0');
    setSearchPhone('');
    setGuestFound(null);
    setFullName('');
    setGuestPhone('');
    setGuestAddress('');
    setGuestPhoto(null);
    setIdFront(null);
    setIdBack(null);

    if (room.status === 'Occupied') {
      setActiveTab('checkout');
      setDrawerLoading(true);
      try {
        const res = await api.get(`/bookings/active/room/${room.id}`);
        if (res.data.exists) setActiveBooking(res.data.booking);
        else setDrawerError('No active booking found for this occupied room.');
      } catch { setDrawerError('Failed to fetch guest booking details.'); }
      finally { setDrawerLoading(false); }
    } else {
      setActiveTab('checkin');
      setActiveBooking(null);
    }
  };

  const handleCloseDrawer = () => { setDrawerOpen(false); setSelectedRoom(null); };

  // ── Guest Search ──────────────────────────────────────────────────────────
  const handleGuestSearch = async () => {
    if (!searchPhone.trim()) return;
    setSearchingGuest(true);
    setDrawerError('');
    setGuestFound(null);
    try {
      const res = await api.get(`/guests/search?phone=${searchPhone.trim()}`);
      if (res.data.exists) {
        setGuestFound(res.data.guest);
        setFullName(res.data.guest.full_name);
        setGuestPhone(res.data.guest.phone_number);
        setGuestAddress(res.data.guest.address || '');
      } else {
        setGuestFound(false);
        const term = searchPhone.trim();
        if (/^\+?[0-9\s\-]+$/.test(term)) { setGuestPhone(term); setFullName(''); }
        else { setFullName(term); setGuestPhone(''); }
        setGuestAddress('');
        setDrawerError('No existing guest found. Please fill the profile below.');
      }
    } catch { setDrawerError('Error searching guest profiles.'); }
    finally { setSearchingGuest(false); }
  };

  // ── Check-In ──────────────────────────────────────────────────────────────
  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    setDrawerError('');
    setDrawerSuccess('');

    if (!expectedCheckout) { setDrawerError('Please select expected checkout date.'); return; }
    if (new Date(expectedCheckout) <= new Date()) { setDrawerError('Expected checkout must be a future date.'); return; }
    if (!roomRate || isNaN(parseFloat(roomRate)) || parseFloat(roomRate) < 0) { setDrawerError('Invalid room rate.'); return; }

    setDrawerLoading(true);
    try {
      let finalGuestId = null;
      if (guestFound && guestFound.id) {
        finalGuestId = guestFound.id;
      } else {
        if (!fullName.trim() || !guestPhone.trim()) { setDrawerError('Guest name and phone are required.'); setDrawerLoading(false); return; }
        const fd = new FormData();
        fd.append('full_name', fullName.trim());
        fd.append('phone_number', guestPhone.trim());
        fd.append('address', guestAddress.trim());
        if (guestPhoto) fd.append('guest_photo', guestPhoto);
        if (idFront) fd.append('id_front', idFront);
        if (idBack) fd.append('id_back', idBack);
        const res = await api.post('/guests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        finalGuestId = res.data.guest.id;
      }
      await api.post('/bookings/checkin', {
        room_id: selectedRoom.id, guest_id: finalGuestId,
        expected_checkout: expectedCheckout, room_rate: parseFloat(roomRate), advance_paid: parseFloat(advancePaid) || 0,
      });
      setDrawerSuccess('✓ Check-in successful! Room is now occupied.');
      setTimeout(() => { handleCloseDrawer(); fetchDashboardData(); }, 1600);
    } catch (err) {
      setDrawerError(err.response?.data?.message || 'Check-in failed. Please verify inputs.');
    } finally { setDrawerLoading(false); }
  };

  // ── Check-Out ─────────────────────────────────────────────────────────────
  const handleCheckOutSubmit = async () => {
    if (!activeBooking) return;
    setDrawerError('');
    setDrawerSuccess('');
    setDrawerLoading(true);
    try {
      await api.post(`/bookings/checkout/${activeBooking.id}`);
      setDrawerSuccess('✓ Check-out finalized! Room is now available.');
      setTimeout(() => { handleCloseDrawer(); fetchDashboardData(); }, 1600);
    } catch (err) {
      setDrawerError(err.response?.data?.message || 'Check-out failed. Please try again.');
    } finally { setDrawerLoading(false); }
  };

  // ── Toggle Maintenance ────────────────────────────────────────────────────
  const toggleMaintenance = async (targetStatus) => {
    setDrawerError('');
    setDrawerSuccess('');
    setDrawerLoading(true);
    try {
      await api.patch(`/rooms/${selectedRoom.id}/status`, { status: targetStatus });
      setDrawerSuccess(`✓ Room status updated to ${targetStatus}.`);
      setTimeout(() => { handleCloseDrawer(); fetchDashboardData(); }, 1600);
    } catch (err) {
      setDrawerError(err.response?.data?.message || 'Failed to update status.');
    } finally { setDrawerLoading(false); }
  };

  // ── Stay calculation ──────────────────────────────────────────────────────
  const stayDetails = (() => {
    if (!activeBooking) return { nights: 0, total: 0, balance: 0 };
    const nights = Math.max(1, Math.ceil(Math.abs(new Date() - new Date(activeBooking.check_in_time)) / 86400000));
    const total  = nights * parseFloat(activeBooking.room_rate);
    return { nights, total, balance: total - parseFloat(activeBooking.advance_paid) };
  })();

  // ── Occupancy % ──────────────────────────────────────────────────────────
  const occupancyPct = stats.totalRooms > 0 ? Math.round((stats.occupied / stats.totalRooms) * 100) : 0;

  const navigate = useNavigate();

  const KPI_CARDS = [
    { label: 'Available Rooms',  value: stats.available,      sub: `of ${stats.totalRooms} total`,    icon: BedDouble, color: 'emerald', to: '/rooms'    },
    { label: 'Occupied Rooms',   value: stats.occupied,       sub: `${occupancyPct}% occupancy`,      icon: Users,     color: 'rose',    to: '/rooms'    },
    { label: 'In Maintenance',   value: stats.maintenance,    sub: 'under service',                   icon: Wrench,    color: 'amber',   to: '/rooms'    },
    { label: 'Check-ins Today',  value: stats.todayCheckins,  sub: 'new arrivals',                    icon: LogIn,     color: 'indigo',  to: '/bookings' },
    { label: 'Check-outs Today', value: stats.todayCheckouts, sub: 'departures',                      icon: LogOut,    color: 'violet',  to: '/history'  },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 relative">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Reception Desk</h1>
          </div>
          <p className="text-slate-400 text-sm ml-0.5">Live room status · Guest check-ins &amp; check-outs</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all self-start shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {KPI_CARDS.map((kpi) => (
          <KpiCard
            key={kpi.label}
            {...kpi}
            loading={loading}
            onClick={() => navigate(kpi.to)}
          />
        ))}
      </div>

      {/* ── OCCUPANCY BAR ──────────────────────────────────────────────────── */}
      {!loading && stats.totalRooms > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-slate-300">Occupancy Overview</span>
            </div>
            <span className="text-xs font-bold text-slate-400">{stats.occupied}/{stats.totalRooms} rooms</span>
          </div>
          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${occupancyPct}%`,
                background: occupancyPct > 80 ? 'linear-gradient(90deg,#f43f5e,#e11d48)' : occupancyPct > 50 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#6366f1,#818cf8)',
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Available: {stats.available}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" />Occupied: {stats.occupied}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Maint: {stats.maintenance}</span>
            </div>
            <span className="text-xs font-black text-slate-300">{occupancyPct}%</span>
          </div>
        </div>
      )}

      {/* ── LIVE ROOM GRID ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
            <BedDouble className="w-5 h-5 text-indigo-400" />
            Live Room Status
            {!loading && (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full ml-1">
                {rooms.length} rooms
              </span>
            )}
          </h2>
          <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Available</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />Occupied</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Maintenance</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse" style={{ minHeight: '120px' }}>
                <div className="h-2 w-16 bg-slate-700/60 rounded mb-4" />
                <div className="h-7 w-12 bg-slate-700/60 rounded mb-4" />
                <div className="h-px bg-slate-800 mb-3" />
                <div className="h-2 w-20 bg-slate-700/60 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl py-16 text-center">
            <BedDouble className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No rooms found. Add some rooms to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {rooms.map((room) => <RoomCard key={room.id} room={room} onClick={handleRoomClick} />)}
          </div>
        )}
      </div>

      {/* ── DRAWER BACKDROP ────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-40 transition-opacity duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={handleCloseDrawer}
      />

      {/* ── SIDE DRAWER ────────────────────────────────────────────────────── */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-slate-950 border-l border-slate-800 z-50 shadow-2xl overflow-y-auto transition-transform duration-300 flex flex-col ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Drawer Header */}
        {selectedRoom && (
          <div className="sticky top-0 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-5 py-4 z-10 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedRoom.status === 'Available' ? 'bg-emerald-500/15 border border-emerald-500/25' :
                  selectedRoom.status === 'Occupied'  ? 'bg-rose-500/15    border border-rose-500/25'    :
                                                        'bg-amber-500/15   border border-amber-500/25'
                }`}>
                  <BedDouble className={`w-5 h-5 ${
                    selectedRoom.status === 'Available' ? 'text-emerald-400' :
                    selectedRoom.status === 'Occupied'  ? 'text-rose-400'    : 'text-amber-400'
                  }`} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">Room {selectedRoom.room_number}</h3>
                  <p className="text-[10px] text-slate-500 font-semibold truncate">
                    {selectedRoom.category} · ₹{parseFloat(selectedRoom.base_rate).toLocaleString('en-IN')}/night
                  </p>
                </div>
              </div>
              <button onClick={handleCloseDrawer} className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0 ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Drawer Body */}
        <div className="flex-1 px-5 py-5 space-y-5">
          {drawerLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" />
              </div>
              <span className="text-sm text-slate-400">Loading guest &amp; billing data...</span>
            </div>
          )}

          {!drawerLoading && (
            <>
              {drawerError && (
                <div className="p-4 bg-red-500/8 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{drawerError}</span>
                </div>
              )}
              {drawerSuccess && (
                <div className="p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-start gap-2.5">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" /><span>{drawerSuccess}</span>
                </div>
              )}

              {/* ── CHECK-IN FORM ─────────────────────────────────── */}
              {activeTab === 'checkin' && selectedRoom?.status !== 'Maintenance' && (
                <form onSubmit={handleCheckInSubmit} className="space-y-5 pb-6">
                  {/* Step 1: Guest search */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Guest Identification</h4>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text" value={searchPhone}
                          onChange={(e) => setSearchPhone(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGuestSearch(); } }}
                          placeholder="Name or phone number..."
                          className="w-full bg-slate-800/80 border border-slate-700 text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 transition-all placeholder-slate-500"
                        />
                      </div>
                      <button type="button" onClick={handleGuestSearch} disabled={searchingGuest || !searchPhone.trim()}
                        className="px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors shrink-0">
                        {searchingGuest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Find
                      </button>
                    </div>
                  </div>

                  {/* Guest info panel */}
                  {guestFound !== null && (
                    <div className={`border rounded-2xl overflow-hidden ${guestFound ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-blue-500/25 bg-blue-500/5'}`}>
                      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${guestFound ? 'border-emerald-500/20' : 'border-blue-500/20'}`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {guestFound ? 'Verified Guest Profile' : 'New Guest Registration'}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${guestFound ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                          {guestFound ? '✓ Found' : '+ New'}
                        </span>
                      </div>
                      <div className="p-4 space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                          <div className="relative">
                            <User className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                            <input type="text" required disabled={!!guestFound} value={fullName} onChange={(e) => setFullName(e.target.value)}
                              placeholder="Guest Full Name"
                              className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                            <input type="text" required disabled={!!guestFound} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)}
                              placeholder="Phone Number"
                              className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Home Address</label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                            <input type="text" disabled={!!guestFound} value={guestAddress} onChange={(e) => setGuestAddress(e.target.value)}
                              placeholder="City, Country"
                              className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all" />
                          </div>
                        </div>

                        {/* KYC for new guests */}
                        {!guestFound && (
                          <div className="space-y-3 pt-2 border-t border-slate-700/50">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />KYC Documents (Optional)
                            </p>
                            {[
                              { label: 'Guest Photo', accept: 'image/*', onChange: (e) => setGuestPhoto(e.target.files[0]) },
                              { label: 'Gov. ID Front', accept: 'image/*,application/pdf', onChange: (e) => setIdFront(e.target.files[0]) },
                              { label: 'Gov. ID Back',  accept: 'image/*,application/pdf', onChange: (e) => setIdBack(e.target.files[0]) },
                            ].map((f) => (
                              <div key={f.label}>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">{f.label}</label>
                                <input type="file" accept={f.accept} onChange={f.onChange}
                                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 file:cursor-pointer cursor-pointer border border-slate-700 p-1.5 rounded-xl bg-slate-800/10" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Booking details */}
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Stay &amp; Billing</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expected Check-Out</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                          <input type="date" required value={expectedCheckout} onChange={(e) => setExpectedCheckout(e.target.value)}
                            className="w-full bg-slate-800/80 border border-slate-700 text-white text-sm rounded-xl pl-9 pr-3 py-3 focus:outline-none focus:border-indigo-500 cursor-pointer" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Daily Rate (₹)</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                          <input type="number" required value={roomRate} onChange={(e) => setRoomRate(e.target.value)} placeholder="Rate"
                            className="w-full bg-slate-800/80 border border-slate-700 text-white text-sm rounded-xl pl-9 pr-3 py-3 focus:outline-none focus:border-indigo-500" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Advance Paid (₹)</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                        <input type="number" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} placeholder="0"
                          className="w-full bg-slate-800/80 border border-slate-700 text-white text-sm rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-indigo-500" />
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    {selectedRoom?.status === 'Available' && (
                      <button type="button" onClick={() => toggleMaintenance('Maintenance')}
                        className="px-4 py-3.5 border border-amber-500/25 bg-amber-500/8 hover:bg-amber-500/15 text-amber-400 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0">
                        <Wrench className="w-4 h-4" />
                      </button>
                    )}
                    <button type="submit" disabled={drawerLoading}
                      className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                      {drawerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                      Confirm Check-In
                    </button>
                  </div>
                </form>
              )}

              {/* ── CHECK-OUT PANEL ───────────────────────────────── */}
              {activeTab === 'checkout' && activeBooking && (
                <div className="space-y-4 pb-6">
                  {/* Guest card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Guest on Record</span>
                    </div>
                    <div className="px-4 py-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Name</span>
                        <span className="font-bold text-white">{activeBooking.guest_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Phone</span>
                        <span className="font-semibold text-slate-300">{activeBooking.guest_phone}</span>
                      </div>
                      {activeBooking.guest_address && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Address</span>
                          <span className="text-slate-400 text-xs text-right max-w-[180px] truncate">{activeBooking.guest_address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stay summary */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Stay Summary</span>
                    </div>
                    <div className="px-4 py-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Check-In</span>
                        <span className="text-slate-300 font-semibold text-xs">{new Date(activeBooking.check_in_time).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Expected Out</span>
                        <span className="text-slate-300 text-xs">{new Date(activeBooking.expected_check_out).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-800 pt-2 mt-1">
                        <span className="text-slate-400 font-semibold">Nights Stayed</span>
                        <span className="font-black text-indigo-400 text-base">{stayDetails.nights}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bill breakdown */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Bill Settlement</span>
                    </div>
                    <div className="px-4 py-4 space-y-2.5 text-sm">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Daily Rate</span>
                        <span>₹{parseFloat(activeBooking.room_rate).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>× {stayDetails.nights} night(s)</span>
                        <span className="font-bold">₹{stayDetails.total.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-400">
                        <span>Advance Paid</span>
                        <span>− ₹{parseFloat(activeBooking.advance_paid).toLocaleString('en-IN')}</span>
                      </div>
                      <div className={`flex items-center justify-between border-t border-slate-800 pt-3 mt-1 text-base font-bold ${stayDetails.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        <span>Balance Due</span>
                        <span className="text-xl font-black">₹{stayDetails.balance.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  <button type="button" onClick={handleCheckOutSubmit} disabled={drawerLoading}
                    className="w-full py-4 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all">
                    {drawerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    Settle Bill &amp; Finalize Check-Out
                  </button>
                </div>
              )}

              {/* ── MAINTENANCE PANEL ─────────────────────────────── */}
              {selectedRoom?.status === 'Maintenance' && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 text-center space-y-5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                    <Wrench className="w-7 h-7 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Under Maintenance</h4>
                    <p className="text-slate-400 text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">This room is currently out of service. Mark it as available once repairs are complete.</p>
                  </div>
                  <button type="button" onClick={() => toggleMaintenance('Available')} disabled={drawerLoading}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 transition-all">
                    {drawerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Mark as Available
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
