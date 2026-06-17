import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api.js';
import InvoiceModal from '../../components/InvoiceModal.jsx';
import {
  Search, History, Calendar, Phone, BedDouble, User,
  Loader2, AlertCircle, X, ExternalLink, Image as ImageIcon,
  FileText, RefreshCw, TrendingUp, CheckCircle2, Clock3,
  XCircle, IndianRupee, ArrowUpRight, Filter, Receipt, Download
} from 'lucide-react';

// ─── Status Config Helper ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Active:    { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
  Completed: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25',          dot: 'bg-blue-400'    },
  Cancelled: { badge: 'bg-red-500/15 text-red-400 border-red-500/25',             dot: 'bg-red-400'     },
};
const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || { badge: 'bg-slate-800 text-slate-400 border-slate-700', dot: 'bg-slate-500' };

// ─── Stat Card Component ─────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, accentClass, icon: Icon }) => (
  <div className={`relative bg-slate-900 border rounded-2xl p-5 overflow-hidden ${accentClass}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className="text-3xl font-black text-white leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1.5 font-medium">{sub}</p>}
      </div>
      <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
    </div>
  </div>
);

const BookingHistory = () => {
  const [bookings, setBookings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter fields
  const [filterGuestName, setFilterGuestName] = useState('');
  const [filterPhone, setFilterPhone]         = useState('');
  const [filterRoomNum, setFilterRoomNum]     = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate]     = useState('');

  // Doc Preview
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedPreview, setSelectedPreview]   = useState(null);

  // Invoice
  const [invoiceBookingId, setInvoiceBookingId] = useState(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchBookings = useCallback(async (overrideParams = null) => {
    setLoading(true);
    setError('');
    try {
      const qp = new URLSearchParams();
      const p = overrideParams || { filterGuestName, filterPhone, filterRoomNum, filterStartDate, filterEndDate };
      if (p.filterGuestName?.trim())  qp.append('guest_name',   p.filterGuestName.trim());
      if (p.filterPhone?.trim())      qp.append('phone_number', p.filterPhone.trim());
      if (p.filterRoomNum?.trim())    qp.append('room_number',  p.filterRoomNum.trim());
      if (p.filterStartDate)          qp.append('start_date',   p.filterStartDate);
      if (p.filterEndDate)            qp.append('end_date',     p.filterEndDate);
      const res = await api.get(`/bookings/history?${qp.toString()}`);
      setBookings(res.data.bookings || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch bookings record log.');
    } finally {
      setLoading(false);
    }
  }, [filterGuestName, filterPhone, filterRoomNum, filterStartDate, filterEndDate]);

  useEffect(() => { fetchBookings(); }, []);

  const handleFilterSubmit = (e) => { e.preventDefault(); fetchBookings(); };

  const handleClearFilters = () => {
    setFilterGuestName(''); setFilterPhone(''); setFilterRoomNum('');
    setFilterStartDate(''); setFilterEndDate('');
    fetchBookings({ filterGuestName: '', filterPhone: '', filterRoomNum: '', filterStartDate: '', filterEndDate: '' });
  };

  // ─── Export Excel (CSV UTF-8 BOM) ─────────────────────────────────────────
  const handleExportExcel = () => {
    const BOM = '\uFEFF';
    const headers = ['Record Ref','Guest Name','Phone','Room','Category','Check-in','Check-out','Nights','Room Rate','Total Amount','Advance Paid','Pending','Status'];
    const rows = filteredBookings.map(b => {
      const cin  = new Date(b.check_in_time);
      const isOpen = new Date(b.expected_check_out).getFullYear() >= 2099;
      const cout = b.actual_check_out ? new Date(b.actual_check_out) : isOpen ? null : new Date(b.expected_check_out);
      const nights = cout ? Math.max(1, Math.ceil(Math.abs(cout - cin) / (1000*60*60*24))) : '—';
      const total   = parseFloat(b.total_amount || 0);
      const advance = parseFloat(b.advance_paid || 0);
      return [
        `REC-${String(b.id).padStart(5,'0')}`,
        b.guest_name,
        b.guest_phone ? `="${b.guest_phone}"` : '',
        `Room ${b.room_number}`,
        b.room_category,
        cin.toLocaleString('en-IN'),
        cout ? cout.toLocaleDateString('en-IN') : (isOpen ? 'Open Stay' : '—'),
        nights,
        parseFloat(b.room_rate || 0).toFixed(2),
        total.toFixed(2),
        advance.toFixed(2),
        (total - advance).toFixed(2),
        b.status,
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
    });
    const csv  = BOM + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `bookings_export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const hasActiveFilters = filterGuestName || filterPhone || filterRoomNum || filterStartDate || filterEndDate;

  // ─── Preview ──────────────────────────────────────────────────────────────
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

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const filteredBookings = bookings.filter((b) => statusFilter === 'All' || b.status === statusFilter);
  const activeCount    = bookings.filter(b => b.status === 'Active').length;
  const completedCount = bookings.filter(b => b.status === 'Completed').length;
  const cancelledCount = bookings.filter(b => b.status === 'Cancelled').length;
  const totalRevenue   = bookings.filter(b => b.status === 'Completed').reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);

  const TABS = [
    { key: 'All',       label: 'All',       count: bookings.length },
    { key: 'Active',    label: 'Active',    count: activeCount    },
    { key: 'Completed', label: 'Completed', count: completedCount },
    { key: 'Cancelled', label: 'Cancelled', count: cancelledCount },
  ];

  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-indigo-400" />
            </span>
            Booking Archive
          </h1>
          <p className="text-slate-400 text-sm mt-1 ml-0.5">Check-in logs, financial audits &amp; guest settlement history</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchBookings()}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-all self-start sm:self-auto shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 self-start sm:self-auto shrink-0"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* ── STATS ROW ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Bookings" value={bookings.length}     sub="all time records"              accentClass="border-slate-800"              icon={TrendingUp}    />
        <StatCard label="Active Now"     value={activeCount}         sub="currently checked-in"         accentClass="border-emerald-500/20"         icon={Clock3}        />
        <StatCard label="Completed"      value={completedCount}      sub="successfully settled"         accentClass="border-blue-500/20"            icon={CheckCircle2}  />
        <StatCard label="Revenue"        value={`₹${(totalRevenue/1000).toFixed(1)}k`} sub="from completed bookings" accentClass="border-violet-500/20" icon={IndianRupee}   />
      </div>

      {/* ── ERROR ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* ── FILTER PANEL ────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Collapsible header */}
        <button
          type="button"
          onClick={() => setFiltersOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Filter className="w-4 h-4 text-indigo-400" />
            Search &amp; Filters
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full">Active</span>
            )}
          </span>
          <span className={`text-slate-500 text-xs transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {filtersOpen && (
          <form onSubmit={handleFilterSubmit} className="px-5 pb-5 border-t border-slate-800/60 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              {/* Guest Name */}
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text" value={filterGuestName} onChange={(e) => setFilterGuestName(e.target.value)}
                  placeholder="Guest name..."
                  className="w-full bg-slate-800/80 border border-slate-700/80 text-white text-xs rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all placeholder-slate-500"
                />
              </div>
              {/* Phone */}
              <div className="relative">
                <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text" value={filterPhone} onChange={(e) => setFilterPhone(e.target.value)}
                  placeholder="Phone number..."
                  className="w-full bg-slate-800/80 border border-slate-700/80 text-white text-xs rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all placeholder-slate-500"
                />
              </div>
              {/* Room */}
              <div className="relative">
                <BedDouble className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text" value={filterRoomNum} onChange={(e) => setFilterRoomNum(e.target.value)}
                  placeholder="Room number..."
                  className="w-full bg-slate-800/80 border border-slate-700/80 text-white text-xs rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all placeholder-slate-500"
                />
              </div>
              {/* Start Date */}
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)}
                  title="Check-in from date"
                  className="w-full bg-slate-800/80 border border-slate-700/80 text-white text-xs rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all cursor-pointer"
                />
              </div>
              {/* End Date */}
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)}
                  title="Check-in to date"
                  className="w-full bg-slate-800/80 border border-slate-700/80 text-white text-xs rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-slate-500">Leave fields empty to show all records</p>
              <div className="flex gap-2.5">
                <button type="button" onClick={handleClearFilters}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all">
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
                <button type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/20">
                  <Search className="w-3.5 h-3.5" /> Search
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── STATUS TABS ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-slate-800 pb-px">
        {TABS.map((tab) => {
          const isActive = statusFilter === tab.key;
          const sc = getStatusConfig(tab.key === 'All' ? null : tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-all cursor-pointer ${
                isActive
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.key !== 'All' && (
                <span className={`w-2 h-2 rounded-full ${isActive ? (sc.dot || 'bg-indigo-400') : 'bg-slate-600'}`} />
              )}
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800/80 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
        <div className="ml-auto shrink-0 text-xs text-slate-500 font-medium pr-1 hidden sm:block">
          {filteredBookings.length} record{filteredBookings.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── TABLE / CARDS ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" />
          </div>
          <span className="text-slate-400 text-sm font-medium">Querying booking archive...</span>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-base font-bold text-slate-300">No Records Found</h3>
          <p className="text-slate-500 text-sm mt-1.5 max-w-xs mx-auto">
            {hasActiveFilters ? 'No bookings match your search filters. Try clearing them.' : `No booking entries with status "${statusFilter}".`}
          </p>
          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors">
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── MOBILE CARDS (< md) ───────────────────────────────────────── */}
          <div className="md:hidden space-y-3">
            {filteredBookings.map((booking) => {
              const sc = getStatusConfig(booking.status);
              return (
                <div key={booking.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  {/* Card Header */}
                  <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-800/60">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-base truncate">{booking.guest_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{booking.guest_phone}
                      </p>
                    </div>
                    <span className={`ml-3 shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${sc.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{booking.status}
                    </span>
                  </div>
                  {/* Card Body */}
                  <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <p className="text-slate-500 font-semibold mb-0.5">Room</p>
                      <p className="text-slate-200 font-bold">Room {booking.room_number} <span className="text-slate-500 font-normal">· {booking.room_category}</span></p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-semibold mb-0.5">Total</p>
                      <p className="text-white font-bold">₹{parseFloat(booking.total_amount).toLocaleString('en-IN')}</p>
                      <p className="text-emerald-400 text-[10px]">Adv: ₹{parseFloat(booking.advance_paid).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-semibold mb-0.5">Check-in</p>
                      <p className="text-slate-300">{new Date(booking.check_in_time).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-semibold mb-0.5">Check-out</p>
                      <p className="text-slate-300">
                        {booking.actual_check_out
                          ? new Date(booking.actual_check_out).toLocaleDateString()
                          : <span className="text-amber-400">{new Date(booking.expected_check_out).toLocaleDateString()} <span className="text-slate-500">(exp)</span></span>}
                      </p>
                    </div>
                  </div>
                  {/* Card Footer – docs */}
                  <div className="px-4 pb-4 pt-2 border-t border-slate-800/60 flex items-center gap-2 flex-wrap">
                    {/* Record Button */}
                    <button
                      onClick={() => setInvoiceBookingId(booking.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-500 hover:text-white transition-all"
                    >
                      <Receipt className="w-3 h-3" />Record
                    </button>
                    {booking.guest_drive_link && (
                      <a href={booking.guest_drive_link} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-all">
                        <ExternalLink className="w-3 h-3" />Drive
                      </a>
                    )}
                    <button disabled={!booking.guest_photo} onClick={() => triggerPreview(booking, 'photo')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${booking.guest_photo ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 cursor-pointer hover:bg-indigo-500/10' : 'text-slate-600 border-slate-800 cursor-default'}`}>
                      <ImageIcon className="w-3 h-3" />Photo
                    </button>
                    <button disabled={!booking.id_front} onClick={() => triggerPreview(booking, 'idFront')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${booking.id_front ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 cursor-pointer hover:bg-indigo-500/10' : 'text-slate-600 border-slate-800 cursor-default'}`}>
                      <FileText className="w-3 h-3" />ID Front
                    </button>
                    {booking.id_back && (
                      <button onClick={() => triggerPreview(booking, 'idBack')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all bg-slate-800 text-indigo-400 border-indigo-500/20 cursor-pointer hover:bg-indigo-500/10">
                        <FileText className="w-3 h-3" />ID Back
                      </button>
                    )}
                    {booking.id_3 && (
                      <button onClick={() => triggerPreview(booking, 'id3')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all bg-slate-800 text-indigo-400 border-indigo-500/20 cursor-pointer hover:bg-indigo-500/10">
                        <FileText className="w-3 h-3" />ID 3
                      </button>
                    )}
                    {booking.id_4 && (
                      <button onClick={() => triggerPreview(booking, 'id4')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all bg-slate-800 text-indigo-400 border-indigo-500/20 cursor-pointer hover:bg-indigo-500/10">
                        <FileText className="w-3 h-3" />ID 4
                      </button>
                    )}
                    {booking.id_5 && (
                      <button onClick={() => triggerPreview(booking, 'id5')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all bg-slate-800 text-indigo-400 border-indigo-500/20 cursor-pointer hover:bg-indigo-500/10">
                        <FileText className="w-3 h-3" />ID 5
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP TABLE (≥ md) ─────────────────────────────────────── */}
          <div className="hidden md:block bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[960px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/30">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">#</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Guest</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Room</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Stay Period</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Financials</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Documents</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-sm">
                  {filteredBookings.map((booking, idx) => {
                    const sc = getStatusConfig(booking.status);
                    return (
                      <tr key={booking.id} className="hover:bg-slate-800/25 transition-colors group">
                        {/* Index */}
                        <td className="px-5 py-4 text-slate-600 font-mono text-xs">{String(idx + 1).padStart(2, '0')}</td>

                        {/* Guest */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm shrink-0">
                              {booking.guest_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-bold text-white">{booking.guest_name}</p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />{booking.guest_phone}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Room */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              <BedDouble className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-200">Room {booking.room_number}</p>
                              <p className="text-[11px] text-slate-500">{booking.room_category}</p>
                            </div>
                          </div>
                        </td>

                        {/* Stay Period */}
                        <td className="px-5 py-4 text-xs text-slate-400 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>
                              <span className="text-slate-500 font-semibold">In: </span>
                              <span className="text-slate-300">{new Date(booking.check_in_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${booking.actual_check_out ? 'bg-blue-500' : (new Date(booking.expected_check_out).getFullYear() >= 2099 ? 'bg-indigo-500' : 'bg-amber-500')}`} />
                            <span>
                              <span className="text-slate-500 font-semibold">Out: </span>
                              {booking.actual_check_out ? (
                                <span className="text-slate-300">{new Date(booking.actual_check_out).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              ) : new Date(booking.expected_check_out).getFullYear() >= 2099 ? (
                                <span className="text-indigo-400 font-bold">Open Stay</span>
                              ) : (
                                <span className="text-amber-400 font-semibold">{new Date(booking.expected_check_out).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} <span className="text-slate-600 font-normal">(exp)</span></span>
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Financials */}
                        <td className="px-5 py-4">
                          <p className="font-bold text-white text-base">₹{parseFloat(booking.total_amount).toLocaleString('en-IN')}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-semibold text-slate-500">Advance:</span>
                            <span className="text-[11px] font-bold text-emerald-400">₹{parseFloat(booking.advance_paid).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-semibold text-slate-500">Rate:</span>
                            <span className="text-[11px] text-slate-400">₹{parseFloat(booking.room_rate || 0).toLocaleString('en-IN')}/night</span>
                          </div>
                        </td>

                        {/* Documents */}
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {booking.guest_drive_link && (
                              <a href={booking.guest_drive_link} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-all"
                                title="Google Drive">
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
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border ${sc.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${booking.status === 'Active' ? 'animate-pulse' : ''}`} />
                            {booking.status}
                          </span>
                        </td>
                        {/* Record */}
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => setInvoiceBookingId(booking.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
                          >
                            <Receipt className="w-3 h-3" />Record
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Table Footer */}
            <div className="px-5 py-3 border-t border-slate-800/60 bg-slate-900/40 flex items-center justify-between text-xs text-slate-500">
              <span>Showing <span className="text-slate-300 font-semibold">{filteredBookings.length}</span> of <span className="text-slate-300 font-semibold">{bookings.length}</span> records</span>
              <span>Filter: <span className="text-slate-300 font-semibold">{statusFilter}</span></span>
            </div>
          </div>
        </>
      )}

      {/* ── DOCUMENT PREVIEW MODAL ─────────────────────────────────────────── */}
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
              <header className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60 backdrop-blur-md shrink-0">
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

      {/* ── RECORD MODAL ──────────────────────────────────────────────────── */}
      {invoiceBookingId && (
        <InvoiceModal
          bookingId={invoiceBookingId}
          onClose={() => setInvoiceBookingId(null)}
        />
      )}
    </div>
  );
};

export default BookingHistory;
