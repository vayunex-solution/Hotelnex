import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import {
  X, ArrowRightLeft, BedDouble, AlertCircle, CheckCircle2,
  Loader2, Snowflake, Droplets, Zap, Sparkles, VolumeX,
  Wind, KeyRound, WifiOff, Star, Tag, ShieldAlert, Wrench,
  ChevronRight, Check
} from 'lucide-react';

const ISSUE_CATEGORIES = [
  { id: 'ac_hvac',     label: 'AC / HVAC',         desc: 'Not cooling/heating, compressor fault',    icon: Snowflake,   color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  chip: 'AC compressor dead'            },
  { id: 'plumbing',    label: 'Plumbing & Water',   desc: 'No hot water, leak, clogged drain',        icon: Droplets,    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  chip: 'Water leakage'                 },
  { id: 'electrical',  label: 'Electrical Fault',   desc: 'Socket dead, sparking, TV malfunction',    icon: Zap,         color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  chip: 'Power outage in room'          },
  { id: 'cleanliness', label: 'Cleanliness',        desc: 'Dirty linen, washroom, pests sighted',     icon: Sparkles,    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', chip: 'Hygiene issue'                 },
  { id: 'noise',       label: 'Noise Disturbance',  desc: 'Neighbors, generator, street traffic',     icon: VolumeX,     color: '#f87171', bg: 'rgba(248,113,113,0.12)', chip: 'Loud street/traffic noise'     },
  { id: 'odor',        label: 'Foul Odor / Smell',  desc: 'Cigarette smoke, dampness, drainage',      icon: Wind,        color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)',  chip: 'Cigarette smoke smell'         },
  { id: 'door_lock',   label: 'Door Lock / Key',    desc: 'Keycard dead, sensor failing, latch jammed', icon: KeyRound,  color: '#818cf8', bg: 'rgba(129,140,248,0.12)', chip: 'Electronic keycard broken'     },
  { id: 'wifi',        label: 'WiFi / Signal',      desc: 'Dead zone, zero mobile reception',         icon: WifiOff,     color: '#34d399', bg: 'rgba(52,211,153,0.12)',  chip: 'No WiFi in room'               },
  { id: 'upgrade',     label: 'Guest Upgrade',      desc: 'Requested Deluxe / Suite category',        icon: Star,        color: '#fcd34d', bg: 'rgba(252,211,77,0.12)',  chip: 'Guest requested upgrade'       },
  { id: 'downgrade',   label: 'Budget Preference',  desc: 'Guest wants lower category room',          icon: Tag,         color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', chip: 'Budget room preference'        },
  { id: 'safety',      label: 'Safety Concern',     desc: 'Broken latch, balcony door, guest unease', icon: ShieldAlert, color: '#fb7185', bg: 'rgba(251,113,133,0.12)', chip: 'Safety / window issue'         },
  { id: 'maintenance', label: 'Maintenance Work',   desc: 'Deep cleaning, pest control, painting',    icon: Wrench,      color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  chip: 'Scheduled maintenance required' },
];

const QUICK_CHIPS = [
  'AC compressor dead', 'No hot water in shower', 'Loud street/traffic noise',
  'Cigarette smoke smell', 'Guest requested higher floor', 'Keycard sensor fail', 'Bathroom drainage clogged'
];

/* ── Stepper pill ─────────────────────────────────────── */
const StepPill = ({ num, label, active, done }) => (
  <div className={`flex items-center gap-2 transition-all duration-300 ${active ? 'opacity-100' : done ? 'opacity-70' : 'opacity-35'}`}>
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-all duration-300"
      style={{
        background: done ? 'linear-gradient(135deg,#10b981,#059669)' : active ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.06)',
        boxShadow: active ? '0 0 12px rgba(99,102,241,0.5)' : done ? '0 0 8px rgba(16,185,129,0.4)' : 'none',
        color: (active || done) ? '#fff' : '#64748b'
      }}
    >
      {done ? <Check className="w-3 h-3" /> : num}
    </div>
    <span className={`text-[11px] font-bold tracking-wide ${active ? 'text-white' : done ? 'text-emerald-400' : 'text-slate-600'}`}>{label}</span>
  </div>
);

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
      setStep(1); setError(''); setSuccessMsg('');
      setSelectedTargetRoom(null); setRatePolicy('keep_current');
      setCustomNotes(''); setMarkMaintenance(true);
      fetchAvailableRooms();
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isOpen && !submitting) onClose(); };
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
    } catch { setError('Unable to load available rooms.'); }
    finally { setLoadingRooms(false); }
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
    setSubmitting(true); setError('');
    try {
      const res = await api.post('/bookings/shift-room', {
        bookingId: booking.id, toRoomId: selectedTargetRoom.id,
        reasonCategory: reasonObj.label, reasonDetails: customNotes.trim(),
        markOldRoomMaintenance: markMaintenance, ratePolicy
      });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Room shifted successfully!');
        setTimeout(() => { if (onSuccess) onSuccess(res.data.data); onClose(); }, 1400);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Shift failed. Please check room availability.');
    } finally { setSubmitting(false); }
  };

  /* ────────── RENDER ────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      style={{ background: 'rgba(2,4,14,0.88)', backdropFilter: 'blur(16px)' }}>

      <div
        className="w-full max-w-2xl flex flex-col max-h-[94vh] sm:max-h-[90vh] rounded-2xl sm:rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg,#0f111a 0%,#0b0d18 100%)',
          border: '1px solid rgba(99,102,241,0.18)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.06) inset'
        }}
      >

        {/* ── HEADER ─────────────────────────────────── */}
        <div className="px-5 sm:px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 0 20px rgba(99,102,241,0.2)' }}>
                <ArrowRightLeft className="w-5 h-5" style={{ color: '#818cf8' }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight">Room Shift & Transfer</h2>
                <p className="text-[11px] sm:text-xs mt-0.5 truncate" style={{ color: '#64748b' }}>
                  <span style={{ color: '#94a3b8' }}>{booking?.guest_name || 'In-House Guest'}</span>
                  <span className="mx-1.5" style={{ color: '#334155' }}>·</span>
                  <span>Current: </span>
                  <span className="font-bold" style={{ color: '#818cf8' }}>Room {booking?.room_number || currentRoom?.room_number}</span>
                  <span className="ml-1" style={{ color: '#475569' }}>({booking?.room_category || currentRoom?.category})</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} disabled={submitting}
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-105 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 mt-4">
            <StepPill num={1} label="Reason"       active={step === 1} done={step > 1} />
            <div className="flex-1 h-px mx-1" style={{ background: step > 1 ? 'linear-gradient(90deg,#6366f1,#10b981)' : 'rgba(255,255,255,0.06)' }} />
            <StepPill num={2} label="Target Room"  active={step === 2} done={step > 2} />
            <div className="flex-1 h-px mx-1" style={{ background: step > 2 ? 'linear-gradient(90deg,#6366f1,#10b981)' : 'rgba(255,255,255,0.06)' }} />
            <StepPill num={3} label="Review & Confirm" active={step === 3} done={false} />
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>

          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{successMsg}</span>
            </div>
          )}

          {/* ─── STEP 1: REASON ─── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Section label */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#475569' }}>Select Issue Category</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>12 Categories</span>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[230px] sm:max-h-[260px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>
                {ISSUE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedReason === cat.id;
                  return (
                    <button key={cat.id} type="button" onClick={() => setSelectedReason(cat.id)}
                      className="text-left p-3 rounded-xl sm:rounded-2xl border transition-all cursor-pointer group relative overflow-hidden"
                      style={{
                        background: isSelected ? `linear-gradient(135deg,${cat.bg},rgba(99,102,241,0.08))` : 'rgba(255,255,255,0.025)',
                        border: isSelected ? `1.5px solid ${cat.color}50` : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: isSelected ? `0 0 20px ${cat.color}20, 0 4px 12px rgba(0,0,0,0.3)` : 'none',
                        transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                      }}>
                      {isSelected && <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: cat.color, boxShadow: `0 0 8px ${cat.color}80` }}>
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>}
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2 shrink-0"
                        style={{ background: cat.bg, border: `1px solid ${cat.color}25` }}>
                        <Icon className="w-4 h-4" style={{ color: cat.color }} />
                      </div>
                      <p className="text-[11px] font-bold leading-tight mb-0.5 line-clamp-1" style={{ color: isSelected ? '#f1f5f9' : '#94a3b8' }}>{cat.label}</p>
                      <p className="text-[9px] sm:text-[10px] leading-tight line-clamp-2" style={{ color: isSelected ? '#64748b' : '#334155' }}>{cat.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Remarks */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Staff Notes / Remarks</p>
                <textarea rows={2} value={customNotes} onChange={e => setCustomNotes(e.target.value)}
                  placeholder="e.g. AC compressor trip, guest reported at 11:30 PM..."
                  className="w-full text-xs placeholder:text-slate-700 text-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'}
                />
                <div className="flex items-center flex-wrap gap-1.5 mt-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#334155' }}>Quick:</span>
                  {QUICK_CHIPS.map((chip, i) => (
                    <button key={i} type="button"
                      onClick={() => setCustomNotes(p => p ? `${p}, ${chip}` : chip)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer hover:scale-105"
                      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#6366f1' }}>
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Maintenance Toggle */}
              <div className="flex items-center justify-between gap-4 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl"
                style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.18)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.2)' }}>
                    <Wrench className="w-4 h-4" style={{ color: '#fb923c' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Mark Room {booking?.room_number || currentRoom?.room_number} as Maintenance</p>
                    <p className="text-[10px] truncate" style={{ color: '#64748b' }}>Blocks room from new check-ins until repaired.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" checked={markMaintenance} onChange={e => setMarkMaintenance(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 rounded-full transition-all peer-checked:bg-orange-500 bg-slate-800 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>
            </div>
          )}

          {/* ─── STEP 2: ROOMS ─── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {['all', 'Standard', 'Deluxe', 'Suite'].map(cat => (
                    <button key={cat} type="button" onClick={() => setCategoryFilter(cat)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                      style={categoryFilter.toLowerCase() === cat.toLowerCase()
                        ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}>
                      {cat === 'all' ? 'All Rooms' : cat}
                    </button>
                  ))}
                </div>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Room no..."
                  className="text-xs text-slate-200 placeholder:text-slate-700 px-3 py-1.5 rounded-xl w-full sm:w-28 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'}
                />
              </div>

              {loadingRooms ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2" style={{ color: '#6366f1' }} />
                  <p className="text-xs" style={{ color: '#475569' }}>Fetching available rooms...</p>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="py-12 text-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <BedDouble className="w-8 h-8 mx-auto mb-2" style={{ color: '#1e293b' }} />
                  <p className="text-sm font-bold" style={{ color: '#334155' }}>No available rooms</p>
                  <p className="text-xs mt-0.5" style={{ color: '#1e293b' }}>All rooms are occupied or under maintenance.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[280px] sm:max-h-[310px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>
                  {filteredRooms.map(room => {
                    const isSelected = selectedTargetRoom?.id === room.id;
                    const base = parseFloat(room.base_rate);
                    const diff = base - currentRate;
                    return (
                      <button key={room.id} type="button" onClick={() => setSelectedTargetRoom(room)}
                        className="p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group"
                        style={{
                          background: isSelected ? 'linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.1))' : 'rgba(255,255,255,0.025)',
                          border: isSelected ? '1.5px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
                          boxShadow: isSelected ? '0 0 24px rgba(99,102,241,0.2), 0 4px 16px rgba(0,0,0,0.4)' : 'none',
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                        }}>
                        {isSelected && <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 10px rgba(99,102,241,0.6)' }}>
                          <Check className="w-3 h-3 text-white" />
                        </div>}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-base font-black" style={{ color: isSelected ? '#e2e8f0' : '#94a3b8' }}>
                            {room.room_number}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>AVAIL</span>
                        </div>
                        <p className="text-[10px] font-semibold mb-2" style={{ color: '#475569' }}>{room.category}</p>
                        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-xs font-black" style={{ color: isSelected ? '#f1f5f9' : '#64748b' }}>₹{base.toLocaleString('en-IN')}<span className="text-[9px] font-normal ml-0.5" style={{ color: '#334155' }}>/nt</span></span>
                          {diff !== 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{
                              background: diff > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(16,185,129,0.1)',
                              color: diff > 0 ? '#fbbf24' : '#34d399'
                            }}>{diff > 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 3: REVIEW ─── */}
          {step === 3 && selectedTargetRoom && (
            <div className="space-y-4">

              {/* Transfer Visual */}
              <div className="flex items-center justify-center gap-3 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-widest mb-1.5 font-bold" style={{ color: '#ef4444' }}>FROM</p>
                  <div className="text-3xl font-black" style={{ color: '#f87171' }}>
                    {booking?.room_number || currentRoom?.room_number}
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#475569' }}>{booking?.room_category || currentRoom?.category}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.12))', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <ArrowRightLeft className="w-4 h-4" style={{ color: '#818cf8' }} />
                  </div>
                  <p className="text-[9px] font-bold" style={{ color: '#334155' }}>SHIFT</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-widest mb-1.5 font-bold" style={{ color: '#10b981' }}>TO</p>
                  <div className="text-3xl font-black" style={{ color: '#34d399' }}>
                    {selectedTargetRoom.room_number}
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#475569' }}>{selectedTargetRoom.category}</p>
                </div>
              </div>

              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Guest', value: booking?.guest_name || 'In-House Guest', valueColor: '#e2e8f0' },
                  { label: 'Reason', value: reasonObj.label, valueColor: '#818cf8' },
                  { label: 'Old Room Status', value: markMaintenance ? '🔧 Under Maintenance' : '✅ Available', valueColor: markMaintenance ? '#fb923c' : '#34d399' },
                  { label: 'New Category', value: selectedTargetRoom.category, valueColor: '#e2e8f0' },
                ].map(({ label, value, valueColor }) => (
                  <div key={label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: '#334155' }}>{label}</p>
                    <p className="text-xs font-bold truncate" style={{ color: valueColor }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Rate Policy */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Rate Adjustment Policy</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      value: 'keep_current', title: 'Complimentary Shift',
                      desc: `Keep current rate ₹${currentRate.toLocaleString('en-IN')}/nt — Best for service issues`
                    },
                    {
                      value: 'apply_new', title: 'Apply New Room Rate',
                      desc: `Charge ₹${targetRate.toLocaleString('en-IN')}/nt (${rateDiff >= 0 ? `+₹${rateDiff}` : `-₹${Math.abs(rateDiff)}`}) — For voluntary upgrades`
                    }
                  ].map(opt => {
                    const isActive = ratePolicy === opt.value;
                    return (
                      <label key={opt.value} className="p-3.5 rounded-xl border cursor-pointer transition-all flex gap-3 items-start"
                        style={{
                          background: isActive ? 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.08))' : 'rgba(255,255,255,0.025)',
                          border: isActive ? '1.5px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
                          boxShadow: isActive ? '0 0 16px rgba(99,102,241,0.15)' : 'none'
                        }}>
                        <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                          style={{ borderColor: isActive ? '#6366f1' : '#334155', background: isActive ? '#6366f1' : 'transparent' }}>
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold" style={{ color: isActive ? '#e2e8f0' : '#64748b' }}>{opt.title}</p>
                          <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: isActive ? '#475569' : '#1e293b' }}>{opt.desc}</p>
                        </div>
                        <input type="radio" name="ratePolicy" value={opt.value} checked={isActive} onChange={() => setRatePolicy(opt.value)} className="sr-only" />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-4 shrink-0 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>

          {step > 1 ? (
            <button type="button" onClick={() => setStep(s => s - 1)} disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
              ← Back
            </button>
          ) : (
            <button type="button" onClick={onClose} disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#475569' }}>
              Cancel
            </button>
          )}

          {step === 1 && (
            <button type="button" onClick={() => { if (!selectedReason) { setError('Please select a reason.'); return; } setError(''); setStep(2); }}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>
              Select Room <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 2 && (
            <button type="button" onClick={() => { if (!selectedTargetRoom) { setError('Please select a destination room.'); return; } setError(''); setStep(3); }}
              disabled={!selectedTargetRoom}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: selectedTargetRoom ? '0 4px 16px rgba(99,102,241,0.4)' : 'none' }}>
              Review Shift <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 3 && (
            <button type="button" onClick={handleSubmitShift} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.4)' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {submitting ? 'Processing...' : 'Confirm & Shift Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomShiftModal;
