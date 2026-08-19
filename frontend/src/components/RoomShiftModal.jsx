import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import {
  X, ArrowRightLeft, BedDouble, AlertCircle, CheckCircle2,
  Loader2, Snowflake, Droplets, Zap, Sparkles, VolumeX,
  Wind, KeyRound, WifiOff, Star, Tag, ShieldAlert, Wrench,
  ChevronRight, Check
} from 'lucide-react';

const ISSUE_CATEGORIES = [
  { id: 'ac_hvac',     label: 'AC / HVAC',         desc: 'Not cooling/heating, compressor fault',      icon: Snowflake,   colorClass: 'text-sky-500 bg-sky-500/10 border-sky-500/25',     chip: 'AC compressor dead'            },
  { id: 'plumbing',    label: 'Plumbing & Water',   desc: 'No hot water, leak, clogged drain',          icon: Droplets,    colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/25',   chip: 'Water leakage'                 },
  { id: 'electrical',  label: 'Electrical Fault',   desc: 'Socket dead, sparking, TV malfunction',      icon: Zap,         colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/25', chip: 'Power outage in room'          },
  { id: 'cleanliness', label: 'Cleanliness',        desc: 'Dirty linen, washroom, pests sighted',       icon: Sparkles,    colorClass: 'text-purple-500 bg-purple-500/10 border-purple-500/25', chip: 'Hygiene issue'              },
  { id: 'noise',       label: 'Noise Disturbance',  desc: 'Neighbors, generator, street traffic',       icon: VolumeX,     colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/25',   chip: 'Loud street/traffic noise'     },
  { id: 'odor',        label: 'Foul Odor / Smell',  desc: 'Cigarette smoke, dampness, drainage',        icon: Wind,        colorClass: 'text-teal-500 bg-teal-500/10 border-teal-500/25',   chip: 'Cigarette smoke smell'         },
  { id: 'door_lock',   label: 'Door Lock / Key',    desc: 'Keycard dead, sensor failing, latch jammed', icon: KeyRound,    colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/25', chip: 'Electronic keycard broken' },
  { id: 'wifi',        label: 'WiFi / Signal',      desc: 'Dead zone, zero mobile reception',           icon: WifiOff,     colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25', chip: 'No WiFi in room'         },
  { id: 'upgrade',     label: 'Guest Upgrade',      desc: 'Requested Deluxe / Suite category',          icon: Star,        colorClass: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/25', chip: 'Guest requested upgrade'   },
  { id: 'downgrade',   label: 'Budget Preference',  desc: 'Guest wants lower category room',            icon: Tag,         colorClass: 'text-slate-500 bg-slate-500/10 border-slate-500/25', chip: 'Budget room preference'        },
  { id: 'safety',      label: 'Safety Concern',     desc: 'Broken latch, balcony door, guest unease',   icon: ShieldAlert, colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/25',   chip: 'Safety / window issue'         },
  { id: 'maintenance', label: 'Maintenance Work',   desc: 'Deep cleaning, pest control, painting',      icon: Wrench,      colorClass: 'text-orange-500 bg-orange-500/10 border-orange-500/25', chip: 'Scheduled repair'          },
];

const QUICK_CHIPS = [
  'AC compressor dead', 'No hot water in shower', 'Loud street/traffic noise',
  'Cigarette smoke smell', 'Guest requested higher floor', 'Keycard sensor fail', 'Bathroom drainage clogged'
];

const RoomShiftModal = ({ isOpen, onClose, booking, currentRoom, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState('ac_hvac');
  const [customNotes, setCustomNotes] = useState('');
  const [markMaintenance, setMarkMaintenance] = useState(true);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedTargetRoom, setSelectedTargetRoom] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [ratePolicy, setRatePolicy] = useState('keep_current');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, submitting, onClose]);

  const fetchAvailableRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await api.get('/rooms');
      if (res.data?.data) {
        const currentId = currentRoom?.id || booking?.room_id;
        setAvailableRooms(res.data.data.filter(r => r.status === 'Available' && String(r.id) !== String(currentId)));
      }
    } catch {
      setError('Unable to load available rooms.');
    } finally {
      setLoadingRooms(false);
    }
  };

  if (!isOpen) return null;

  const currentRate   = parseFloat(booking?.room_rate || currentRoom?.base_rate || 0);
  const targetRate    = parseFloat(selectedTargetRoom?.base_rate || 0);
  const rateDiff      = targetRate - currentRate;
  const reasonObj     = ISSUE_CATEGORIES.find(c => c.id === selectedReason) || ISSUE_CATEGORIES[0];

  const filteredRooms = availableRooms.filter(r => {
    const matchCat    = categoryFilter === 'all' || r.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchSearch = !searchQuery.trim() || r.room_number.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchCat && matchSearch;
  });

  const handleSubmitShift = async () => {
    if (!selectedTargetRoom || !booking?.id) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/bookings/shift-room', {
        bookingId: booking.id,
        toRoomId: selectedTargetRoom.id,
        reasonCategory: reasonObj.label,
        reasonDetails: customNotes.trim(),
        markOldRoomMaintenance: markMaintenance,
        ratePolicy
      });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Room shifted successfully!');
        setTimeout(() => {
          if (onSuccess) onSuccess(res.data.data);
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Shift failed. Please check room availability.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">Room Shift &amp; Transfer</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Guest: <span className="font-bold text-slate-800 dark:text-slate-200">{booking?.guest_name || 'In-House Guest'}</span> · Current: <span className="font-bold text-indigo-600 dark:text-indigo-400">Room {booking?.room_number || currentRoom?.room_number}</span> ({booking?.room_category || currentRoom?.category})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── STEPPER ──────────────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-100/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold select-none">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${step > 1 ? 'bg-emerald-500' : step === 1 ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {step > 1 ? '✓' : '1'}
            </span>
            <span>Reason</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${step > 2 ? 'bg-emerald-500' : step === 2 ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {step > 2 ? '✓' : '2'}
            </span>
            <span>Target Room</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${step === 3 ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              3
            </span>
            <span>Review &amp; Confirm</span>
          </div>
        </div>

        {/* ── BODY ─────────────────────────────────────────────────────────── */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-white dark:bg-slate-900">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {/* ─── STEP 1: REASON ─── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Select Issue Reason (12 Categories)
                </label>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500">Tap to select</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[240px] sm:max-h-[260px] overflow-y-auto pr-1">
                {ISSUE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedReason === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedReason(cat.id)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-600/20 border-indigo-500 shadow-sm ring-1 ring-indigo-500/40'
                          : 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 border ${cat.colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate mb-0.5">{cat.label}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">{cat.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Remarks Notes */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                  Staff Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g. AC compressor trip, guest requested immediate shift..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />

                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Quick:</span>
                  {QUICK_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCustomNotes(prev => prev ? `${prev}, ${chip}` : chip)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Maintenance Toggle */}
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3.5 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      Mark Room {booking?.room_number || currentRoom?.room_number} as 'Under Maintenance'
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Blocks this room from new check-ins until repaired.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={markMaintenance}
                    onChange={(e) => setMarkMaintenance(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 sm:w-11 sm:h-6 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>
            </div>
          )}

          {/* ─── STEP 2: DESTINATION ROOM ─── */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {['all', 'Standard', 'Deluxe', 'Suite'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        categoryFilter.toLowerCase() === cat.toLowerCase()
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {cat === 'all' ? 'All Rooms' : cat}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Room..."
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-full sm:w-36"
                />
              </div>

              {loadingRooms ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fetching available rooms...</p>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="py-14 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center px-4 space-y-2">
                  <BedDouble className="w-9 h-9 text-slate-400 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Available Destination Rooms</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">All other rooms are occupied or locked in maintenance.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 max-h-[280px] sm:max-h-[300px] overflow-y-auto pr-1">
                  {filteredRooms.map((room) => {
                    const isSelected = selectedTargetRoom?.id === room.id;
                    const roomBase = parseFloat(room.base_rate);
                    const diff = roomBase - currentRate;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedTargetRoom(room)}
                        className={`p-3.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-600/20 border-indigo-500 shadow-md ring-2 ring-indigo-500/40'
                            : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-base font-black text-slate-900 dark:text-white">Room {room.room_number}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            Avail
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-2">{room.category}</p>
                        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">₹{roomBase.toLocaleString('en-IN')}<span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">/nt</span></span>
                          {diff !== 0 && (
                            <span className={`text-[10px] font-black ${diff > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
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

          {/* ─── STEP 3: REVIEW & CONFIRM ─── */}
          {step === 3 && selectedTargetRoom && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Shift Route</span>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400">
                      Room {booking?.room_number || currentRoom?.room_number}
                    </span>
                    <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                      Room {selectedTargetRoom.room_number}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Guest Name</p>
                    <p className="text-slate-900 dark:text-white font-bold truncate">{booking?.guest_name || 'In-House Guest'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Reason</p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold truncate">{reasonObj.label}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Old Room Status</p>
                    <p className={`font-bold ${markMaintenance ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {markMaintenance ? 'Under Maintenance' : 'Available'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">New Category</p>
                    <p className="text-slate-900 dark:text-white font-bold">{selectedTargetRoom.category}</p>
                  </div>
                </div>
              </div>

              {/* Rate Policy Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-2">
                  Rate Adjustment Policy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      ratePolicy === 'keep_current'
                        ? 'bg-indigo-50/80 dark:bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Complimentary Shift</span>
                      <input
                        type="radio"
                        name="ratePolicy"
                        value="keep_current"
                        checked={ratePolicy === 'keep_current'}
                        onChange={() => setRatePolicy('keep_current')}
                        className="text-indigo-600 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Keep current rate of <strong className="text-slate-900 dark:text-white font-bold">₹{currentRate.toLocaleString('en-IN')}</strong>. Best for service or maintenance issues.
                    </p>
                  </label>

                  <label
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      ratePolicy === 'apply_new'
                        ? 'bg-indigo-50/80 dark:bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Apply New Room Rate</span>
                      <input
                        type="radio"
                        name="ratePolicy"
                        value="apply_new"
                        checked={ratePolicy === 'apply_new'}
                        onChange={() => setRatePolicy('apply_new')}
                        className="text-indigo-600 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Charge new rate of <strong className="text-slate-900 dark:text-white font-bold">₹{targetRate.toLocaleString('en-IN')}</strong> ({rateDiff >= 0 ? `+₹${rateDiff}` : `-₹${Math.abs(rateDiff)}`}/nt). Best for guest upgrades.
                    </p>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-between shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              ← Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}

          {step === 1 && (
            <button
              type="button"
              onClick={() => {
                if (!selectedReason) { setError('Please select a reason.'); return; }
                setError('');
                setStep(2);
              }}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Select Room <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={() => {
                if (!selectedTargetRoom) { setError('Please select a destination room.'); return; }
                setError('');
                setStep(3);
              }}
              disabled={!selectedTargetRoom}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Review Shift <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={handleSubmitShift}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? 'Processing Shift...' : 'Confirm & Shift Now'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default RoomShiftModal;
