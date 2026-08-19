import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import {
  X, ArrowRightLeft, BedDouble, AlertCircle, CheckCircle2,
  Loader2, Snowflake, Droplets, Zap, Sparkles, VolumeX,
  Wind, KeyRound, WifiOff, Star, Tag, ShieldAlert, Wrench,
  ChevronRight, IndianRupee, ShieldCheck, Check, Sparkle
} from 'lucide-react';

const ISSUE_CATEGORIES = [
  {
    id: 'ac_hvac',
    label: 'AC / HVAC Breakdown',
    desc: 'AC not cooling/heating, compressor noise, thermostat error',
    icon: Snowflake,
    bg: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    chip: 'AC Not Cooling'
  },
  {
    id: 'plumbing',
    label: 'Plumbing & Water Leakage',
    desc: 'No hot water, pipe leak, low pressure, clogged toilet/drain',
    icon: Droplets,
    bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    chip: 'Water Leakage'
  },
  {
    id: 'electrical',
    label: 'Electrical & Power Fault',
    desc: 'Socket dead, light sparking, TV/appliance malfunction',
    icon: Zap,
    bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    chip: 'Power Fault'
  },
  {
    id: 'cleanliness',
    label: 'Cleanliness & Hygiene',
    desc: 'Stained bed linen, dirty washroom, pests/insects observed',
    icon: Sparkles,
    bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    chip: 'Hygiene Issue'
  },
  {
    id: 'noise',
    label: 'Noise Disturbance',
    desc: 'Loud neighbors, lift/generator noise, street traffic',
    icon: VolumeX,
    bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    chip: 'Loud Noise'
  },
  {
    id: 'odor',
    label: 'Foul Odor / Smell',
    desc: 'Cigarette smoke, dampness, drainage odor in room',
    icon: Wind,
    bg: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
    chip: 'Smoking / Foul Odor'
  },
  {
    id: 'door_lock',
    label: 'Door Lock / Keycard Failure',
    desc: 'Electronic lock battery dead, sensor failing, latch jammed',
    icon: KeyRound,
    bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    chip: 'Keycard Lock Broken'
  },
  {
    id: 'wifi',
    label: 'WiFi & Connectivity Issue',
    desc: 'Wi-Fi dead zone, zero mobile reception inside room',
    icon: WifiOff,
    bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    chip: 'No WiFi in Room'
  },
  {
    id: 'upgrade',
    label: 'Guest Upgrade Request',
    desc: 'Guest requested higher category / Deluxe / Suite',
    icon: Star,
    bg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    chip: 'Guest Requested Upgrade'
  },
  {
    id: 'downgrade',
    label: 'Guest Downgrade / Budget',
    desc: 'Guest requested budget-friendly lower category room',
    icon: Tag,
    bg: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
    chip: 'Budget Room Preference'
  },
  {
    id: 'safety',
    label: 'Safety & Security Concern',
    desc: 'Broken window latch, balcony door issue, guest unease',
    icon: ShieldAlert,
    bg: 'bg-red-500/10 border-red-500/20 text-red-400',
    chip: 'Safety / Window Issue'
  },
  {
    id: 'maintenance',
    label: 'Scheduled Maintenance',
    desc: 'Deep cleaning, pest control, painting, or urgent repairs',
    icon: Wrench,
    bg: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    chip: 'Scheduled Deep Repair'
  }
];

const QUICK_REMARK_CHIPS = [
  'AC compressor dead',
  'No hot water in shower',
  'Loud street/traffic noise',
  'Cigarette smoke smell',
  'Guest requested higher floor',
  'Electronic keycard sensor fail',
  'Bathroom drainage clogged'
];

const RoomShiftModal = ({ isOpen, onClose, booking, currentRoom, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Reason, 2: Destination Room, 3: Rate & Confirm
  const [selectedReason, setSelectedReason] = useState('ac_hvac');
  const [customNotes, setCustomNotes] = useState('');
  const [markMaintenance, setMarkMaintenance] = useState(true);

  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedTargetRoom, setSelectedTargetRoom] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [ratePolicy, setRatePolicy] = useState('keep_current'); // 'keep_current' or 'apply_new'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset states on modal open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError('');
      setSuccessMsg('');
      setSelectedTargetRoom(null);
      setRatePolicy('keep_current');
      setCustomNotes('');
      setMarkMaintenance(true);
      fetchAvailableRooms();
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  const fetchAvailableRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await api.get('/rooms');
      if (res.data?.rooms) {
        const currentId = currentRoom?.id || booking?.room_id;
        const avail = res.data.rooms.filter(
          r => r.status === 'Available' && String(r.id) !== String(currentId)
        );
        setAvailableRooms(avail);
      }
    } catch (err) {
      console.error('Failed to fetch rooms for shift:', err);
      setError('Unable to load available rooms. Please try again.');
    } finally {
      setLoadingRooms(false);
    }
  };

  if (!isOpen) return null;

  const currentRate = parseFloat(booking?.room_rate || currentRoom?.base_rate || 0);
  const targetRate = parseFloat(selectedTargetRoom?.base_rate || 0);
  const rateDiff = targetRate - currentRate;

  // Filter available rooms
  const filteredRooms = availableRooms.filter(r => {
    const matchCat = categoryFilter === 'all' || r.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchSearch = !searchQuery.trim() || r.room_number.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchCat && matchSearch;
  });

  const selectedReasonObj = ISSUE_CATEGORIES.find(c => c.id === selectedReason) || ISSUE_CATEGORIES[0];

  const handleNextToRooms = () => {
    if (!selectedReason) {
      setError('Please select a shift reason.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleNextToConfirm = () => {
    if (!selectedTargetRoom) {
      setError('Please select a destination room.');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleSubmitShift = async () => {
    if (!selectedTargetRoom || !booking?.id) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        bookingId: booking.id,
        toRoomId: selectedTargetRoom.id,
        reasonCategory: selectedReasonObj.label,
        reasonDetails: customNotes.trim(),
        markOldRoomMaintenance: markMaintenance,
        ratePolicy: ratePolicy
      };

      const res = await api.post('/bookings/shift-room', payload);

      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Room shifted successfully!');
        setTimeout(() => {
          if (onSuccess) onSuccess(res.data.data);
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to shift room. Please verify room availability.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppendChip = (chipText) => {
    setCustomNotes(prev => prev ? `${prev}, ${chipText}` : chipText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800/80 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-sm shadow-indigo-500/10">
              <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Shift / Transfer Room
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Guest: <span className="font-semibold text-slate-200">{booking?.guest_name || 'In-House Guest'}</span> · Current: <span className="font-bold text-indigo-400">Room {booking?.room_number || currentRoom?.room_number}</span> ({booking?.room_category || currentRoom?.category})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0 ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Stepper Navigation ───────────────────────────────────────────── */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between text-[11px] sm:text-xs font-semibold select-none">
          <div className={`flex items-center gap-1.5 sm:gap-2 ${step >= 1 ? 'text-indigo-400' : 'text-slate-500'}`}>
            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black ${step >= 1 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>1</span>
            <span>Reason</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />
          <div className={`flex items-center gap-1.5 sm:gap-2 ${step >= 2 ? 'text-indigo-400' : 'text-slate-500'}`}>
            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black ${step >= 2 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>2</span>
            <span>Target Room</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />
          <div className={`flex items-center gap-1.5 sm:gap-2 ${step >= 3 ? 'text-indigo-400' : 'text-slate-500'}`}>
            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black ${step >= 3 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>3</span>
            <span>Review &amp; Shift</span>
          </div>
        </div>

        {/* ── Modal Body ─────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl sm:rounded-2xl text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl sm:rounded-2xl text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* ──────── STEP 1: SELECT REASON ──────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                    Shift Reason (12 Categories)
                  </label>
                  <span className="text-[10px] text-slate-500">Tap to select</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 max-h-[220px] sm:max-h-[250px] overflow-y-auto pr-1">
                  {ISSUE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedReason === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedReason(cat.id)}
                        className={`text-left p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/30'
                            : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'bg-indigo-500 text-white' : cat.bg
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                              {cat.label}
                            </p>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />}
                          </div>
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                            {cat.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specific Remarks + Quick Chips */}
              <div>
                <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Remarks / Staff Notes
                </label>
                <textarea
                  rows={2}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g. AC compressor trip, guest reported at 11:30 PM..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 sm:p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />

                {/* Quick 1-tap chip suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] text-slate-500 font-semibold mr-0.5">Quick chips:</span>
                  {QUICK_REMARK_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAppendChip(chip)}
                      className="px-2 py-0.5 bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Maintenance Toggle */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Mark Room {booking?.room_number || currentRoom?.room_number} as 'Under Maintenance'</p>
                    <p className="text-[10px] text-slate-400 truncate">Blocks this room from new check-ins until fixed.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={markMaintenance}
                    onChange={(e) => setMarkMaintenance(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 sm:w-11 sm:h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          )}

          {/* ──────── STEP 2: AVAILABLE ROOMS ──────── */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {['all', 'Standard', 'Deluxe', 'Suite'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                        categoryFilter.toLowerCase() === cat.toLowerCase()
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                          : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {cat === 'all' ? 'All Rooms' : cat}
                    </button>
                  ))}
                </div>

                {/* Room Search */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Room..."
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 w-full sm:w-36"
                />
              </div>

              {/* Rooms Grid */}
              {loadingRooms ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Fetching available rooms...</p>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="py-12 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-center px-4">
                  <BedDouble className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No available rooms match</p>
                  <p className="text-xs text-slate-500 mt-1">All other rooms are occupied or under maintenance.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 max-h-[270px] sm:max-h-[300px] overflow-y-auto pr-1">
                  {filteredRooms.map((room) => {
                    const isSelected = selectedTargetRoom?.id === room.id;
                    const roomBase = parseFloat(room.base_rate);
                    const diff = roomBase - currentRate;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedTargetRoom(room)}
                        className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all relative cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/40'
                            : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-sm sm:text-base font-black text-white">Room {room.room_number}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Avail
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-400 font-medium mb-2">{room.category}</p>
                        <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs">
                          <span className="font-bold text-white">₹{roomBase.toLocaleString('en-IN')}<span className="text-[10px] text-slate-500 font-normal">/nt</span></span>
                          {diff !== 0 && (
                            <span className={`text-[10px] font-black ${diff > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {diff > 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ──────── STEP 3: RATE & CONFIRM ──────── */}
          {step === 3 && selectedTargetRoom && (
            <div className="space-y-4">
              {/* Transfer Summary Badge */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                  <span className="text-slate-400 font-medium">Room Shift Summary</span>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400">
                      Room {booking?.room_number || currentRoom?.room_number}
                    </span>
                    <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      Room {selectedTargetRoom.room_number}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Guest Name</p>
                    <p className="text-white font-semibold truncate">{booking?.guest_name || 'In-House Guest'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Reason</p>
                    <p className="text-indigo-400 font-semibold truncate">{selectedReasonObj.label}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Old Room Post-Shift</p>
                    <p className={`font-semibold ${markMaintenance ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {markMaintenance ? 'Under Maintenance' : 'Available'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">New Category</p>
                    <p className="text-white font-semibold">{selectedTargetRoom.category}</p>
                  </div>
                </div>
              </div>

              {/* Rate Adjustment Selector */}
              <div>
                <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Rate Adjustment Policy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <label className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    ratePolicy === 'keep_current'
                      ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/40'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white">Complimentary Shift</span>
                      <input
                        type="radio"
                        name="ratePolicy"
                        value="keep_current"
                        checked={ratePolicy === 'keep_current'}
                        onChange={() => setRatePolicy('keep_current')}
                        className="text-indigo-600 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">Keep current rate of <strong className="text-white">₹{currentRate.toLocaleString('en-IN')}</strong>. Best for maintenance or service issues.</p>
                  </label>

                  <label className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    ratePolicy === 'apply_new'
                      ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/40'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white">Apply New Room Rate</span>
                      <input
                        type="radio"
                        name="ratePolicy"
                        value="apply_new"
                        checked={ratePolicy === 'apply_new'}
                        onChange={() => setRatePolicy('apply_new')}
                        className="text-indigo-600 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Charge new rate of <strong className="text-white">₹{targetRate.toLocaleString('en-IN')}</strong> ({rateDiff >= 0 ? `+₹${rateDiff}` : `-₹${Math.abs(rateDiff)}`}/nt). Best for voluntary upgrades.
                    </p>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-800 bg-slate-950/95 flex items-center justify-between shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={submitting}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-800 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}

          {step === 1 && (
            <button
              type="button"
              onClick={handleNextToRooms}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Select Room <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={handleNextToConfirm}
              disabled={!selectedTargetRoom}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Review Shift <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={handleSubmitShift}
              disabled={submitting}
              className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm &amp; Shift Now
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default RoomShiftModal;
