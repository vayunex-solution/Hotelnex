import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api.js';
import {
  Plus, Check, X, Loader2, AlertCircle, Search,
  User, Phone, MapPin, Calendar, Camera,
  Image as ImageIcon, FileText, ExternalLink, ShieldCheck,
  BedDouble, LogOut, IndianRupee, Clock, Zap, RefreshCw,
  ArrowUpRight, Users
} from 'lucide-react';

// ─── Stat Mini Card ───────────────────────────────────────────────────────────
const MiniStat = ({ label, value, sub, color }) => {
  const c = {
    emerald: 'border-emerald-500/25 text-emerald-400',
    rose:    'border-rose-500/25    text-rose-400',
    indigo:  'border-indigo-500/25  text-indigo-400',
    violet:  'border-violet-500/25  text-violet-400',
  };
  return (
    <div className={`bg-slate-900/70 border rounded-2xl p-4 sm:p-5 ${c[color]?.split(' ')[0]}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">{label}</p>
      <p className={`text-2xl sm:text-3xl font-black ${c[color]?.split(' ')[1] || 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1 font-medium">{sub}</p>}
    </div>
  );
};

// ─── Active Booking Card (mobile) ────────────────────────────────────────────
const BookingCard = ({ booking, onCheckout, onPreview }) => {
  const nights = Math.max(1, Math.ceil(Math.abs(new Date() - new Date(booking.check_in_time)) / 86400000));
  const isOpenStay = new Date(booking.expected_check_out).getFullYear() >= 2099;
  const isOverdue = !isOpenStay && new Date(booking.expected_check_out) < new Date();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-800/60">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-sm shrink-0">
            {booking.guest_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-base truncate">{booking.guest_name}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" />{booking.guest_phone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        <div>
          <p className="text-slate-500 font-semibold mb-0.5">Room</p>
          <p className="text-white font-bold">Room {booking.room_number} <span className="text-slate-500 font-normal">· {booking.room_category}</span></p>
        </div>
        <div>
          <p className="text-slate-500 font-semibold mb-0.5">Nights So Far</p>
          <p className="font-bold text-indigo-400">{nights} night{nights !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <p className="text-slate-500 font-semibold mb-0.5">Check-in</p>
          <p className="text-slate-300">{new Date(booking.check_in_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
        <div>
          <p className="text-slate-500 font-semibold mb-0.5">Expected Out</p>
          <p className={isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}>
            {isOpenStay ? (
              <span className="text-indigo-400 font-bold">Open Stay</span>
            ) : (
              <>
                {new Date(booking.expected_check_out).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                {isOverdue && ' ⚠'}
              </>
            )}
          </p>
        </div>
        <div>
          <p className="text-slate-500 font-semibold mb-0.5">Total</p>
          <p className="text-white font-bold">₹{parseFloat(booking.total_amount).toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-slate-500 font-semibold mb-0.5">Advance Paid</p>
          <p className="text-emerald-400 font-bold">₹{parseFloat(booking.advance_paid).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Card footer */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {booking.guest_drive_link && (
            <a href={booking.guest_drive_link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-all">
              <ExternalLink className="w-3 h-3" />Drive
            </a>
          )}
          {booking.guest_photo && (
            <button onClick={() => onPreview(booking, 'photo')}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-500/10 transition-all">
              <ImageIcon className="w-3 h-3" />Photo
            </button>
          )}
          {booking.id_front && (
            <button onClick={() => onPreview(booking, 'idFront')}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-500/10 transition-all">
              <FileText className="w-3 h-3" />ID Front
            </button>
          )}
          {booking.id_back && (
            <button onClick={() => onPreview(booking, 'idBack')}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-500/10 transition-all">
              <FileText className="w-3 h-3" />ID Back
            </button>
          )}
          {booking.id_3 && (
            <button onClick={() => onPreview(booking, 'id3')}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-500/10 transition-all">
              <FileText className="w-3 h-3" />ID 3
            </button>
          )}
          {booking.id_4 && (
            <button onClick={() => onPreview(booking, 'id4')}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-500/10 transition-all">
              <FileText className="w-3 h-3" />ID 4
            </button>
          )}
          {booking.id_5 && (
            <button onClick={() => onPreview(booking, 'id5')}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-500/10 transition-all">
              <FileText className="w-3 h-3" />ID 5
            </button>
          )}
        </div>
        <button onClick={() => onCheckout(booking)}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-rose-500/10 shrink-0">
          <LogOut className="w-3.5 h-3.5" />Checkout
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Bookings = () => {
  const [activeBookings, setActiveBookings] = useState([]);
  const [rooms, setRooms]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');

  const [checkinModalOpen, setCheckinModalOpen]   = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen]   = useState(false);
  const [selectedPreview, setSelectedPreview]     = useState(null);
  const [selectedBooking, setSelectedBooking]     = useState(null);

  // Check-in form
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchingGuest, setSearchingGuest] = useState(false);
  const [guestFound, setGuestFound]         = useState(null);
  const [guestName, setGuestName]           = useState('');
  const [guestPhone, setGuestPhone]         = useState('');
  const [guestAddress, setGuestAddress]     = useState('');
  const [guestDriveLink, setGuestDriveLink] = useState('');
  const [photoFile, setPhotoFile]   = useState(null);
  const [idFiles, setIdFiles]       = useState(Array(5).fill(null)); // 5 ID document slots
  const [companions, setCompanions] = useState([]);                  // [{name, phone, idFiles:[null x 3]}]

  // Camera
  const [cameraTarget, setCameraTarget]   = useState(null); // {type:'photo'|'idSlot'|'companionId', index?, compIndex?, idIndex?}
  const [cameraStream, setCameraStream]   = useState(null);
  const [facingMode, setFacingMode]       = useState('environment'); // 'user'=front | 'environment'=back
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  // Booking params
  const [selectedRoomId, setSelectedRoomId]       = useState('');
  const [expectedCheckout, setExpectedCheckout]   = useState('');
  const [hasExpectedCheckout, setHasExpectedCheckout] = useState(true);
  const [roomRate, setRoomRate]                   = useState('');
  const [advancePaid, setAdvancePaid]             = useState('0');
  const [formLoading, setFormLoading]             = useState(false);
  const [formError, setFormError]                 = useState('');

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchActiveBookings = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/bookings/history');
      setActiveBookings((res.data.bookings || []).filter(b => b.status === 'Active'));
    } catch { setError('Failed to fetch active bookings.'); }
    finally { setLoading(false); }
  }, []);

  const fetchRooms = async () => {
    try { const res = await api.get('/rooms'); setRooms(res.data.data || []); }
    catch (err) { console.error('Failed to fetch rooms', err); }
  };

  useEffect(() => { fetchActiveBookings(); fetchRooms(); }, [fetchActiveBookings]);

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = async (target) => {
    setFormError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300, facingMode } });
      setCameraStream(stream);
      setCameraTarget(target);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch { setFormError('Unable to access camera. Please check permissions.'); }
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode } });
        setCameraStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { setFormError('Failed to switch camera.'); }
    }
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCameraTarget(null);
  };

  const getCameraLabel = () => {
    if (!cameraTarget) return '';
    if (cameraTarget.type === 'photo') return 'Guest Photo';
    if (cameraTarget.type === 'idSlot') return `ID Document ${cameraTarget.index + 1}`;
    if (cameraTarget.type === 'companionId') return `Companion ${cameraTarget.compIndex + 1} — ID ${cameraTarget.idIndex + 1}`;
    return '';
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      canvasRef.current.toBlob(blob => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' });
          if (cameraTarget.type === 'photo') {
            setPhotoFile(file);
          } else if (cameraTarget.type === 'idSlot') {
            setIdFiles(prev => prev.map((f, i) => i === cameraTarget.index ? file : f));
          } else if (cameraTarget.type === 'companionId') {
            setCompanions(prev => prev.map((c, ci) =>
              ci === cameraTarget.compIndex
                ? { ...c, idFiles: c.idFiles.map((f, ii) => ii === cameraTarget.idIndex ? file : f) }
                : c
            ));
          }
          stopCamera();
        }
      }, 'image/png');
    }
  };
  useEffect(() => () => { cameraStream?.getTracks().forEach(t => t.stop()); }, [cameraStream]);

  // ── Companion Helpers ─────────────────────────────────────────────────────
  const addCompanion    = () => setCompanions(prev => [...prev, { name: '', phone: '', idFiles: Array(3).fill(null) }]);
  const removeCompanion = (i) => setCompanions(prev => prev.filter((_, idx) => idx !== i));
  const updateCompanion = (i, field, val) => setCompanions(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  const updateCompanionId = (ci, ii, file) => setCompanions(prev => prev.map((c, idx) =>
    idx === ci ? { ...c, idFiles: c.idFiles.map((f, fIdx) => fIdx === ii ? file : f) } : c
  ));

  // ── Guest Lookup ──────────────────────────────────────────────────────────
  const handleGuestLookup = async () => {
    if (!searchQuery.trim()) return;
    setSearchingGuest(true); setFormError(''); setGuestFound(null);
    try {
      const res = await api.get(`/guests/search?phone=${encodeURIComponent(searchQuery.trim())}`);
      if (res.data.exists) {
        const g = res.data.guest;
        setGuestFound(g); setGuestName(g.full_name); setGuestPhone(g.phone_number);
        setGuestAddress(g.address || ''); setGuestDriveLink(g.document_url || '');
      } else {
        setGuestFound(false);
        const term = searchQuery.trim();
        if (/^\+?[0-9\s\-]+$/.test(term)) { setGuestPhone(term); setGuestName(''); }
        else { setGuestName(term); setGuestPhone(''); }
        setGuestAddress(''); setGuestDriveLink('');
        setFormError('No existing guest found. Fill details below to register new profile.');
      }
    } catch { setFormError('Error searching guest profiles.'); }
    finally { setSearchingGuest(false); }
  };

  // ── Room select ───────────────────────────────────────────────────────────
  const handleRoomChange = (roomId) => {
    setSelectedRoomId(roomId);
    const r = rooms.find(r => r.id === parseInt(roomId));
    setRoomRate(r ? r.base_rate.toString() : '');
  };

  // ── Check-In Submit ───────────────────────────────────────────────────────
  const handleCheckInSubmit = async (e) => {
    e.preventDefault(); setFormError('');
    if (!selectedRoomId) { setFormError('Please select a room.'); return; }
    if (hasExpectedCheckout) {
      if (!expectedCheckout) { setFormError('Please select expected checkout date.'); return; }
      if (new Date(expectedCheckout) <= new Date()) { setFormError('Expected checkout must be a future date.'); return; }
    }
    if (!roomRate || isNaN(parseFloat(roomRate)) || parseFloat(roomRate) < 0) { setFormError('Invalid room rate.'); return; }

    setFormLoading(true);
    try {
      let finalGuestId = null;
      const fd = new FormData();
      fd.append('full_name', guestName.trim());
      fd.append('phone_number', guestPhone.trim());
      fd.append('address', guestAddress.trim());
      fd.append('document_url', guestDriveLink.trim());
      if (photoFile) fd.append('guest_photo', photoFile);
      // Map 5 ID slots → backend field names
      const idFieldNames = ['id_front', 'id_back', 'id_3', 'id_4', 'id_5'];
      idFiles.forEach((file, i) => { if (file) fd.append(idFieldNames[i], file); });

      if (guestFound?.id) {
        const res = await api.put(`/guests/${guestFound.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        finalGuestId = res.data.guest.id;
      } else {
        if (!guestName.trim() || !guestPhone.trim()) { setFormError('Name and phone are required.'); setFormLoading(false); return; }
        const res = await api.post('/guests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        finalGuestId = res.data.guest.id;
      }

      // Register companion guests
      const companionGuestIds = [];
      for (const comp of companions) {
        if (!comp.name.trim() || !comp.phone.trim()) continue;
        const cfd = new FormData();
        cfd.append('full_name', comp.name.trim());
        cfd.append('phone_number', comp.phone.trim());
        const cIdNames = ['id_front', 'id_back', 'id_3'];
        comp.idFiles.forEach((file, i) => { if (file) cfd.append(cIdNames[i], file); });
        const cRes = await api.post('/guests', cfd, { headers: { 'Content-Type': 'multipart/form-data' } });
        companionGuestIds.push(cRes.data.guest.id);
      }

      await api.post('/bookings/checkin', {
        room_id: parseInt(selectedRoomId), guest_id: finalGuestId,
        expected_checkout: hasExpectedCheckout ? expectedCheckout : null,
        room_rate: parseFloat(roomRate), advance_paid: parseFloat(advancePaid) || 0,
        companion_ids: companionGuestIds
      });
      setSuccess('✓ Check-in created successfully!');
      setCheckinModalOpen(false);
      fetchActiveBookings(); fetchRooms();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Check-in failed. Please verify input parameters.');
    } finally { setFormLoading(false); }
  };

  // ── Check-Out Submit ──────────────────────────────────────────────────────
  const handleCheckOutSubmit = async () => {
    if (!selectedBooking) return;
    setFormLoading(true); setFormError('');
    try {
      await api.post(`/bookings/checkout/${selectedBooking.id}`);
      setSuccess('✓ Checkout settled & room released!');
      setCheckoutModalOpen(false); setSelectedBooking(null);
      fetchActiveBookings(); fetchRooms();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to complete checkout.');
    } finally { setFormLoading(false); }
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  const triggerPreview = (booking, initialTab) => {
    setSelectedPreview({
      guestName: booking.guest_name,
      photo: booking.guest_photo,
      idFront: booking.id_front,
      idBack: booking.id_back,
      id3: booking.id_3,
      id4: booking.id_4,
      id5: booking.id_5,
      activeTab: initialTab
    });
    setPreviewModalOpen(true);
  };

  // ── Stay Summary ──────────────────────────────────────────────────────────
  const staySummary = (() => {
    if (!selectedBooking) return { nights: 0, total: 0, balance: 0 };
    const nights = Math.max(1, Math.ceil(Math.abs(new Date() - new Date(selectedBooking.check_in_time)) / 86400000));
    const total  = nights * parseFloat(selectedBooking.room_rate);
    return { nights, total, balance: total - parseFloat(selectedBooking.advance_paid) };
  })();

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3500); return () => clearTimeout(t); }
  }, [success]);

  // ── Reset checkin form ─────────────────────────────────────────────────────
  const openCheckinModal = () => {
    setFormError(''); setSearchQuery(''); setGuestFound(null);
    setGuestName(''); setGuestPhone(''); setGuestAddress(''); setGuestDriveLink('');
    setPhotoFile(null); setIdFiles(Array(5).fill(null)); setCompanions([]);
    setSelectedRoomId(''); setExpectedCheckout(''); setHasExpectedCheckout(true); setRoomRate(''); setAdvancePaid('0');
    setCameraTarget(null);
    setCheckinModalOpen(true);
  };

  const availableRooms = rooms.filter(r => r.status === 'Available');
  const totalRevenue   = activeBookings.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);

  return (
    <div className="space-y-6">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <BedDouble className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Front Desk</h1>
          </div>
          <p className="text-slate-400 text-sm ml-0.5">Active check-ins · Advance collections · Guest settlements</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button onClick={fetchActiveBookings}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-all shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCheckinModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Check-In</span>
            <span className="sm:hidden">Check-In</span>
          </button>
        </div>
      </div>

      {/* ── STATS ROW ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MiniStat label="Active Check-Ins" value={loading ? '…' : activeBookings.length} sub="currently occupied" color="emerald" />
        <MiniStat label="Available Rooms"  value={loading ? '…' : availableRooms.length} sub="ready for booking"  color="indigo" />
        <MiniStat label="Revenue Pending"  value={loading ? '…' : `₹${(totalRevenue/1000).toFixed(1)}k`} sub="from active stays" color="violet" />
        <MiniStat label="Total Rooms"      value={loading ? '…' : rooms.length} sub="in property"         color="rose" />
      </div>

      {/* ── ALERTS ─────────────────────────────────────────────────────────── */}
      {success && (
        <div className="p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2.5">
          <Check className="w-5 h-5 shrink-0" /><span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/8 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" />
          </div>
          <span className="text-slate-400 text-sm font-medium">Loading active check-ins...</span>
        </div>
      ) : activeBookings.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto">
            <BedDouble className="w-8 h-8 text-slate-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-300">No Active Check-Ins</h3>
            <p className="text-slate-500 text-sm mt-1.5">All rooms are currently vacant. Create a new check-in to get started.</p>
          </div>
          <button onClick={openCheckinModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/15">
            <Plus className="w-4 h-4" />Create First Check-In
          </button>
        </div>
      ) : (
        <>
          {/* ── MOBILE: Card Grid ──────────────────────────────────────── */}
          <div className="md:hidden space-y-4">
            {activeBookings.map(b => (
              <BookingCard key={b.id} booking={b}
                onCheckout={(bk) => { setSelectedBooking(bk); setFormError(''); setCheckoutModalOpen(true); }}
                onPreview={triggerPreview} />
            ))}
          </div>

          {/* ── DESKTOP: Premium Table ─────────────────────────────────── */}
          <div className="hidden md:block bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[960px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/30">
                    {['#', 'Guest', 'Room', 'Stay Period', 'Financials', 'Documents', 'Status', 'Action'].map((h, i) => (
                      <th key={h} className={`px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 ${i === 7 ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-sm">
                  {activeBookings.map((booking, idx) => {
                    const nights   = Math.max(1, Math.ceil(Math.abs(new Date() - new Date(booking.check_in_time)) / 86400000));
                    const isOpenStay = new Date(booking.expected_check_out).getFullYear() >= 2099;
                    const isOverdue = !isOpenStay && new Date(booking.expected_check_out) < new Date();
                    const balance  = (nights * parseFloat(booking.room_rate)) - parseFloat(booking.advance_paid);
                    return (
                      <tr key={booking.id} className="hover:bg-slate-800/25 transition-colors group">
                        {/* # */}
                        <td className="px-5 py-4 text-slate-600 font-mono text-xs">{String(idx + 1).padStart(2, '0')}</td>

                        {/* Guest */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm shrink-0">
                              {booking.guest_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-bold text-white">{booking.guest_name}</p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{booking.guest_phone}</p>
                            </div>
                          </div>
                        </td>

                        {/* Room */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                              <BedDouble className="w-4 h-4 text-rose-400" />
                            </div>
                            <div>
                              <p className="font-bold text-white">Room {booking.room_number}</p>
                              <p className="text-[11px] text-slate-500">{booking.room_category}</p>
                            </div>
                          </div>
                        </td>

                        {/* Stay Period */}
                        <td className="px-5 py-4 text-xs space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-slate-400"><span className="text-slate-500">In: </span>
                              {new Date(booking.check_in_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? 'bg-rose-500 animate-pulse' : isOpenStay ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                            <span className={isOverdue ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                              <span className="text-slate-500">Out: </span>
                              {isOpenStay ? (
                                <span className="text-indigo-400 font-bold">Open Stay</span>
                              ) : (
                                <>
                                  {new Date(booking.expected_check_out).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {isOverdue && ' ⚠ Overdue'}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />{nights} night{nights !== 1 ? 's' : ''}
                          </div>
                        </td>

                        {/* Financials */}
                        <td className="px-5 py-4">
                          <p className="font-bold text-white text-base">₹{parseFloat(booking.total_amount).toLocaleString('en-IN')}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-slate-500">Rate:</span>
                            <span className="text-[11px] text-slate-400">₹{parseFloat(booking.room_rate).toLocaleString('en-IN')}/night</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-500">Advance:</span>
                            <span className="text-[11px] font-bold text-emerald-400">₹{parseFloat(booking.advance_paid).toLocaleString('en-IN')}</span>
                          </div>
                          {balance > 0 && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-500">Balance:</span>
                              <span className="text-[11px] font-bold text-rose-400">₹{balance.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                        </td>

                        {/* Documents */}
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {booking.guest_drive_link && (
                              <a href={booking.guest_drive_link} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-all">
                                <ExternalLink className="w-3 h-3" />Drive
                              </a>
                            )}
                            <button disabled={!booking.guest_photo} onClick={() => triggerPreview(booking, 'photo')}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${booking.guest_photo ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/15 cursor-pointer' : 'text-slate-750 border-slate-800/80 cursor-default text-slate-500'}`}>
                              <ImageIcon className="w-3 h-3" />Photo
                            </button>
                            <button disabled={!booking.id_front} onClick={() => triggerPreview(booking, 'idFront')}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${booking.id_front ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/15 cursor-pointer' : 'text-slate-750 border-slate-800/80 cursor-default text-slate-500'}`}>
                              <FileText className="w-3 h-3" />ID Front
                            </button>
                            <button disabled={!booking.id_back} onClick={() => triggerPreview(booking, 'idBack')}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${booking.id_back ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/15 cursor-pointer' : 'text-slate-750 border-slate-800/80 cursor-default text-slate-500'}`}>
                              <FileText className="w-3 h-3" />ID Back
                            </button>
                            {booking.id_3 && (
                              <button onClick={() => triggerPreview(booking, 'id3')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all bg-slate-800 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/15 cursor-pointer">
                                <FileText className="w-3 h-3" />ID 3
                              </button>
                            )}
                            {booking.id_4 && (
                              <button onClick={() => triggerPreview(booking, 'id4')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all bg-slate-800 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/15 cursor-pointer">
                                <FileText className="w-3 h-3" />ID 4
                              </button>
                            )}
                            {booking.id_5 && (
                              <button onClick={() => triggerPreview(booking, 'id5')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all bg-slate-800 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/15 cursor-pointer">
                                <FileText className="w-3 h-3" />ID 5
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4 text-right">
                          <button onClick={() => { setSelectedBooking(booking); setFormError(''); setCheckoutModalOpen(true); }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/10 transition-all">
                            <LogOut className="w-3.5 h-3.5" />Settle &amp; Checkout
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Table footer */}
            <div className="px-5 py-3 border-t border-slate-800/60 bg-slate-900/40 flex items-center justify-between text-xs text-slate-500">
              <span><span className="text-slate-300 font-semibold">{activeBookings.length}</span> active booking{activeBookings.length !== 1 ? 's' : ''}</span>
              <span className="text-emerald-400 font-semibold">Total pending: ₹{totalRevenue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </>
      )}

      {/* ── CHECK-IN MODAL ─────────────────────────────────────────────────── */}
      {checkinModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl relative my-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">New Booking / Check-In</h2>
                  <p className="text-[10px] text-slate-500">{availableRooms.length} room{availableRooms.length !== 1 ? 's' : ''} available</p>
                </div>
              </div>
              <button onClick={() => { stopCamera(); setCheckinModalOpen(false); }}
                className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3.5 bg-red-500/8 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCheckInSubmit} className="space-y-5">
                {/* Step 1 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center">1</span>
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Guest Lookup</span>
                    </div>
                    <button type="button" onClick={() => { setGuestFound(false); setGuestName(''); setGuestPhone(''); setGuestAddress(''); setGuestDriveLink(''); setPhotoFile(null); setIdFrontFile(null); setIdBackFile(null); setFormError(''); }}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer">
                      <Plus className="w-3 h-3" />New Guest
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                      <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleGuestLookup(); } }}
                        placeholder="Search by name or phone..."
                        className="w-full bg-slate-800/80 border border-slate-700 text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 transition-all placeholder-slate-500" />
                    </div>
                    <button type="button" onClick={handleGuestLookup} disabled={searchingGuest || !searchQuery.trim()}
                      className="px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors shrink-0">
                      {searchingGuest ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find'}
                    </button>
                  </div>
                </div>

                {/* Guest profile panel */}
                {guestFound !== null && (
                  <div className={`border rounded-2xl overflow-hidden ${guestFound ? 'border-emerald-500/25' : 'border-blue-500/25'}`}>
                    <div className={`px-4 py-2.5 border-b flex items-center justify-between ${guestFound ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-blue-500/20 bg-blue-500/5'}`}>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{guestFound ? 'Verified Guest' : 'New Guest Registration'}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${guestFound ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>{guestFound ? '✓ Found' : '+ New'}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                          <input type="text" required value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full Name"
                            className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone *</label>
                          <input type="text" required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="Phone Number"
                            className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-all" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
                        <input type="text" value={guestAddress} onChange={e => setGuestAddress(e.target.value)} placeholder="City, Country"
                          className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-all" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Google Drive Link</label>
                        <input type="url" value={guestDriveLink} onChange={e => setGuestDriveLink(e.target.value)} placeholder="https://drive.google.com/..."
                          className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-all" />
                      </div>

                      {/* ── KYC Section ── */}
                      <div className="space-y-3 pt-2.5 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />KYC Documents
                          </p>
                          {guestFound && <span className="text-[10px] text-slate-600 italic">Blank = keep existing</span>}
                        </div>

                        {/* ── Live Camera Panel ── */}
                        {cameraTarget && (
                          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 animate-pulse" />{getCameraLabel()}
                              </span>
                              <div className="flex items-center gap-2">
                                {/* Front / Back camera toggle */}
                                <button type="button" onClick={switchCamera}
                                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg font-bold transition-all">
                                  🔄 {facingMode === 'user' ? 'Front Cam' : 'Back Cam'}
                                </button>
                                <button type="button" onClick={stopCamera} className="text-slate-500 hover:text-white transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="relative aspect-[4/3] w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={stopCamera} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors">Cancel</button>
                              <button type="button" onClick={capturePhoto} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/10">📸 Capture</button>
                            </div>
                          </div>
                        )}

                        <canvas ref={canvasRef} width="640" height="480" className="hidden" />

                        {/* ── Guest Photo ── */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Guest Photo</label>
                          {photoFile ? (
                            <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 p-2 rounded-xl">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-[10px] text-slate-400 flex-1 truncate">{photoFile.name}</span>
                              <button type="button" onClick={() => setPhotoFile(null)} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors">
                                <Plus className="w-3.5 h-3.5" />Upload
                                <input type="file" accept="image/*" onChange={e => { if (e.target.files[0]) setPhotoFile(e.target.files[0]); }} className="hidden" />
                              </label>
                              <button type="button" onClick={() => startCamera({ type: 'photo' })} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 rounded-xl text-xs font-bold transition-all">
                                <Camera className="w-3.5 h-3.5" />Camera
                              </button>
                            </div>
                          )}
                        </div>

                        {/* ── 5 ID Document Slots ── */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ID Documents <span className="text-indigo-400 font-black">(Min. 5 slots)</span></p>
                          {idFiles.map((file, idx) => (
                            <div key={idx}>
                              <p className="text-[9px] text-slate-600 font-semibold mb-1">
                                ID {idx + 1}{idx === 0 ? ' · Primary Front' : idx === 1 ? ' · Primary Back' : ''}
                              </p>
                              {file ? (
                                <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 p-2 rounded-xl">
                                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="text-[10px] text-slate-400 flex-1 truncate">{file.name}</span>
                                  <button type="button" onClick={() => setIdFiles(prev => prev.map((f, i) => i === idx ? null : f))} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <div className="flex gap-1.5">
                                  <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 border border-slate-700 hover:bg-slate-800 text-slate-400 rounded-xl text-[10px] font-semibold cursor-pointer transition-colors">
                                    <Plus className="w-3 h-3" />Upload File
                                    <input type="file" accept="image/*,application/pdf" onChange={e => { if (e.target.files[0]) setIdFiles(prev => prev.map((f, i) => i === idx ? e.target.files[0] : f)); }} className="hidden" />
                                  </label>
                                  <button type="button" onClick={() => startCamera({ type: 'idSlot', index: idx })} className="flex items-center gap-1 py-1.5 px-3 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-bold transition-all">
                                    <Camera className="w-3 h-3" />Cam
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* ── Companions Section ── */}
                        <div className="space-y-2.5 pt-2.5 border-t border-slate-800">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-violet-400" />Companions {companions.length > 0 && <span className="text-violet-400">({companions.length})</span>}
                            </p>
                            <button type="button" onClick={addCompanion}
                              className="text-[10px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 transition-colors">
                              <Plus className="w-3 h-3" />Add Companion
                            </button>
                          </div>

                          {companions.map((comp, ci) => (
                            <div key={ci} className="border border-violet-500/20 bg-violet-500/3 rounded-xl p-3 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-violet-400 flex items-center gap-1.5">
                                  <User className="w-3 h-3" />Companion {ci + 1}
                                </span>
                                <button type="button" onClick={() => removeCompanion(ci)} className="text-slate-600 hover:text-red-400 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input value={comp.name} onChange={e => updateCompanion(ci, 'name', e.target.value)}
                                  placeholder="Full Name *"
                                  className="bg-slate-800/80 border border-slate-700 text-white text-[10px] rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 transition-all" />
                                <input value={comp.phone} onChange={e => updateCompanion(ci, 'phone', e.target.value)}
                                  placeholder="Phone *"
                                  className="bg-slate-800/80 border border-slate-700 text-white text-[10px] rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 transition-all" />
                              </div>
                              {/* Companion ID slots (3) */}
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">ID Documents</p>
                                {comp.idFiles.map((file, ii) => (
                                  <div key={ii}>
                                    {file ? (
                                      <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 p-1.5 rounded-lg">
                                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                        <span className="text-[9px] text-slate-400 flex-1 truncate">{file.name}</span>
                                        <button type="button" onClick={() => updateCompanionId(ci, ii, null)} className="text-red-400 hover:text-red-300"><X className="w-2.5 h-2.5" /></button>
                                      </div>
                                    ) : (
                                      <div className="flex gap-1.5">
                                        <label className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 border border-slate-700 hover:bg-slate-800 text-slate-500 rounded-lg text-[9px] font-semibold cursor-pointer transition-colors">
                                          <Plus className="w-2.5 h-2.5" />ID {ii + 1}
                                          <input type="file" accept="image/*,application/pdf" onChange={e => { if (e.target.files[0]) updateCompanionId(ci, ii, e.target.files[0]); }} className="hidden" />
                                        </label>
                                        <button type="button" onClick={() => startCamera({ type: 'companionId', compIndex: ci, idIndex: ii })}
                                          className="flex items-center gap-1 py-1.5 px-2 bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 text-violet-400 rounded-lg text-[9px] font-bold transition-all">
                                          <Camera className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 */}
                <div className="space-y-3 pt-1 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center">2</span>
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Room &amp; Booking</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Available Room *</label>
                      <select value={selectedRoomId} onChange={e => handleRoomChange(e.target.value)}
                        className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3 py-3 focus:outline-none focus:border-indigo-500 cursor-pointer">
                        <option value="">-- Select Room --</option>
                        {availableRooms.map(r => (
                          <option key={r.id} value={r.id}>Room {r.room_number} ({r.category} · ₹{r.base_rate})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Daily Rate (₹) *</label>
                      <input type="number" required value={roomRate} onChange={e => setRoomRate(e.target.value)} placeholder="Rate"
                        className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3 py-3 focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Advance Paid (₹)</label>
                      <input type="number" value={advancePaid} onChange={e => setAdvancePaid(e.target.value)} placeholder="0"
                        className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3 py-3 focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div className="col-span-2 bg-slate-800/25 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3 mt-1">
                      <label className="flex items-center gap-2.5 text-xs font-bold text-slate-300 cursor-pointer select-none">
                        <input type="checkbox" checked={hasExpectedCheckout} onChange={e => { setHasExpectedCheckout(e.target.checked); if(!e.target.checked) setExpectedCheckout(''); }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                        Specify Expected Checkout Date
                      </label>
                      {hasExpectedCheckout && (
                        <div className="w-40 shrink-0">
                          <input type="date" required={hasExpectedCheckout} value={expectedCheckout} onChange={e => setExpectedCheckout(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { stopCamera(); setCheckinModalOpen(false); }}
                    className="flex-1 py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={formLoading || guestFound === null}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                    {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Confirm Check-In
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── CHECKOUT MODAL ─────────────────────────────────────────────────── */}
      {checkoutModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-rose-500/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Settle &amp; Checkout</h2>
                  <p className="text-[10px] text-slate-500">Room {selectedBooking.room_number} · {selectedBooking.guest_name}</p>
                </div>
              </div>
              <button onClick={() => { setCheckoutModalOpen(false); setSelectedBooking(null); }}
                className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="p-3.5 bg-red-500/8 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
                </div>
              )}

              {/* Guest info */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Guest Details</p>
                {[['Name', selectedBooking.guest_name], ['Phone', selectedBooking.guest_phone], selectedBooking.guest_address && ['Address', selectedBooking.guest_address]].filter(Boolean).map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold text-slate-200 text-right max-w-[200px] truncate">{value}</span>
                  </div>
                ))}
              </div>

              {/* Bill summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-800/40 border-b border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bill Breakdown</p>
                </div>
                <div className="px-4 py-4 space-y-2.5 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>Rate / night</span>
                    <span>₹{parseFloat(selectedBooking.room_rate).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>{staySummary.nights} night{staySummary.nights !== 1 ? 's' : ''} × ₹{parseFloat(selectedBooking.room_rate).toLocaleString('en-IN')}</span>
                    <span className="font-bold">₹{staySummary.total.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Advance paid</span>
                    <span>− ₹{parseFloat(selectedBooking.advance_paid).toLocaleString('en-IN')}</span>
                  </div>
                  <div className={`flex justify-between pt-3 border-t border-slate-800 text-base font-bold ${staySummary.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    <span>Balance Due</span>
                    <span className="text-xl font-black">₹{staySummary.balance.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Confirm */}
              <div className="flex gap-3">
                <button onClick={() => { setCheckoutModalOpen(false); setSelectedBooking(null); }}
                  className="flex-1 py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors">
                  Cancel
                </button>
                <button onClick={handleCheckOutSubmit} disabled={formLoading}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm Checkout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENT PREVIEW ───────────────────────────────────────────────── */}
      {previewModalOpen && selectedPreview && (() => {
        const activeUrl = selectedPreview.activeTab === 'photo' ? selectedPreview.photo
                        : selectedPreview.activeTab === 'idFront' ? selectedPreview.idFront
                        : selectedPreview.activeTab === 'idBack' ? selectedPreview.idBack
                        : selectedPreview.activeTab === 'id3' ? selectedPreview.id3
                        : selectedPreview.activeTab === 'id4' ? selectedPreview.id4
                        : selectedPreview.activeTab === 'id5' ? selectedPreview.id5
                        : null;
        const isPdf = activeUrl?.toLowerCase()?.endsWith('.pdf');
        return (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ height: 'min(85vh, 700px)' }}>
              <header className="px-5 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  {selectedPreview.guestName}'s Documents
                </h3>
                <div className="flex items-center gap-2">
                  {activeUrl && (
                    <a href={activeUrl} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all">
                      <ArrowUpRight className="w-3.5 h-3.5" />Open
                    </a>
                  )}
                  <button onClick={() => { setPreviewModalOpen(false); setSelectedPreview(null); }}
                    className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </header>

              {/* Document Switcher Tabs */}
              <div className="px-5 py-2.5 border-b border-slate-800/60 bg-slate-900/40 flex gap-2 shrink-0 overflow-x-auto">
                {[
                  { key: 'photo', label: 'Guest Photo', url: selectedPreview.photo, icon: ImageIcon },
                  { key: 'idFront', label: 'ID Front', url: selectedPreview.idFront, icon: FileText },
                  { key: 'idBack', label: 'ID Back', url: selectedPreview.idBack, icon: FileText },
                  { key: 'id3', label: 'ID 3', url: selectedPreview.id3, icon: FileText },
                  { key: 'id4', label: 'ID 4', url: selectedPreview.id4, icon: FileText },
                  { key: 'id5', label: 'ID 5', url: selectedPreview.id5, icon: FileText },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      disabled={!tab.url}
                      onClick={() => setSelectedPreview(prev => ({ ...prev, activeTab: tab.key }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        selectedPreview.activeTab === tab.key
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : tab.url
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750 cursor-pointer'
                          : 'bg-slate-900/30 border-slate-900/20 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-auto">
                {activeUrl ? (
                  isPdf ? (
                    <iframe src={activeUrl} title="PDF" className="w-full h-full border-0 rounded-xl" />
                  ) : (
                    <img src={activeUrl} alt="KYC Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-slate-800" />
                  )
                ) : (
                  <p className="text-slate-500 text-sm">Document not uploaded/available</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Bookings;
