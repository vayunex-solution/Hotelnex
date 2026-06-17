import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api.js';
import {
  X, Printer, Download, Hotel, MapPin, Phone, Calendar,
  BedDouble, Users, IndianRupee, Clock, FileText, Loader2,
  AlertCircle, CheckSquare, Square, User
} from 'lucide-react';

// ─── Helper ───────────────────────────────────────────────────────────────────
const fmt = (dateStr, opts = {}) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (d.getFullYear() >= 2099) return 'Open Stay';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    ...opts
  });
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (d.getFullYear() >= 2099) return 'Open Stay';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const BLANK = '___________________________';

// ─── InvoiceModal Component ───────────────────────────────────────────────────
const InvoiceModal = ({ bookingId, onClose }) => {
  const [booking, setBooking]   = useState(null);
  const [settings, setSettings] = useState({ name: 'HotelNex', phone_number: '', address: '' });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Toggle blanks for hand-writing
  const [blankCheckin,  setBlankCheckin]  = useState(false);
  const [blankCheckout, setBlankCheckout] = useState(false);
  const printRef = useRef(null);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [bRes, sRes] = await Promise.all([
          api.get(`/bookings/${bookingId}`),
          api.get('/settings'),
        ]);
        setBooking(bRes.data.booking);
        setSettings(sRes.data.settings || {});
      } catch (e) {
        setError('Failed to load invoice data. ' + (e?.response?.data?.message || ''));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [bookingId]);

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ── Download as text fallback (no-lib CSV) ─────────────────────────────────
  // Real PDF generation needs a lib — we use window.print() with PDF save.
  // The Download button just triggers print too (browser saves as PDF).
  const handleDownload = () => window.print();

  if (loading) return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-sm">Loading record…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="text-red-300 text-sm font-medium">{error}</p>
        <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-all">Close</button>
      </div>
    </div>
  );

  if (!booking) return null;

  const isOpen = new Date(booking.expected_check_out).getFullYear() >= 2099;
  const nights = (() => {
    const cin  = new Date(booking.check_in_time);
    const cout = booking.actual_check_out ? new Date(booking.actual_check_out)
               : isOpen ? null : new Date(booking.expected_check_out);
    if (!cout) return '—';
    const diff = Math.ceil(Math.abs(cout - cin) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  })();

  const pending = parseFloat(booking.total_amount || 0) - parseFloat(booking.advance_paid || 0);

  return (
    <>
      {/* ── PRINT STYLES (injected via style tag) ────────────────────────── */}
      {/* ── PRINT STYLES ────────────────────────────────────────── */}
      <style>{`
        @media print {
          body, html {
            background: white !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          .printable-invoice, .printable-invoice * {
            visibility: visible;
          }
          .printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 12mm 14mm;
            background: #fff !important;
            color: #000 !important;
            font-family: 'Arial', sans-serif;
            font-size: 11pt;
          }
          .printable-invoice * { 
            color: #000 !important; 
            border-color: #888 !important; 
          }
          .print-header { border-bottom: 2px solid #000 !important; margin-bottom: 8mm; padding-bottom: 4mm; }
          .print-table th, .print-table td { border: 1px solid #888 !important; padding: 4px 8px; }
          .print-signature-line { border-top: 1px solid #000 !important; }
          .no-print, .no-print * { display: none !important; visibility: hidden !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      {/* ── SCREEN OVERLAY ───────────────────────────────────────────────── */}
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/90 backdrop-blur-md z-[100] flex items-start justify-center p-3 sm:p-5 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto">
          
          {/* Modal Header */}
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 gap-4 sm:gap-0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/25 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">Guest Physical Record</h2>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">Ref: REC-{String(booking.id).padStart(5, '0')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 self-end sm:self-auto w-full sm:w-auto justify-end">
              <button onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white rounded-xl text-sm font-semibold transition-all whitespace-nowrap">
                <Download className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Save PDF</span>
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap">
                <Printer className="w-4 h-4 shrink-0" /> Print
              </button>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
              <button onClick={onClose}
                className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0">
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>
          </div>
          {/* Print Toggles */}
          <div className="no-print px-5 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Square className="w-3.5 h-3.5" /> Blank fields for hand-writing:</p>
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={() => setBlankCheckin(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {blankCheckin ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-slate-400" />} Check-in Time
              </button>
              <button onClick={() => setBlankCheckout(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {blankCheckout ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-slate-400" />} Check-out Time/Date
              </button>
            </div>
          </div>
          {/* ── PRINTABLE CARD ──────────────────────────────────────────── */}
          <div className="overflow-y-auto flex-1">
            <div ref={printRef} className="printable-invoice p-6 sm:p-8 space-y-5 text-slate-800 dark:text-slate-100">
              
              {/* ── LETTERHEAD ─────────────────────────────────────────── */}
              <div className="print-header pb-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Hotel className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">{settings.name || 'HotelNex'}</h1>
                    {settings.address && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{settings.address}
                      </p>
                    )}
                    {settings.phone_number && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />{settings.phone_number}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Physical Record</p>
                  <p className="text-lg font-black text-indigo-400 mt-0.5">Ref: REC-{String(booking.id).padStart(5, '0')}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Issued: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* ── STAY DETAILS ───────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                {/* Room */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                    <BedDouble className="w-3 h-3" /> Room
                  </p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">Room {booking.room_number}</p>
                  <p className="text-xs text-slate-400">{booking.room_category}</p>
                </div>
                {/* Rate */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                    <IndianRupee className="w-3 h-3" /> Rate
                  </p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">₹{parseFloat(booking.room_rate || 0).toLocaleString('en-IN')}<span className="text-xs text-slate-500 font-normal">/night</span></p>
                  <p className="text-xs text-slate-400">{typeof nights === 'number' ? `${nights} night${nights > 1 ? 's' : ''}` : 'Open stay'}</p>
                </div>
              </div>

              {/* ── CHECK-IN / CHECK-OUT ───────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-emerald-400" /> Check-in
                  </p>
                  <p className="text-sm font-bold text-emerald-300">
                    {blankCheckin ? BLANK : fmt(booking.check_in_time)}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-amber-400" /> {booking.actual_check_out ? 'Check-out' : 'Exp. Check-out'}
                  </p>
                  <p className="text-sm font-bold text-amber-300">
                    {blankCheckout ? BLANK : (booking.actual_check_out ? fmt(booking.actual_check_out) : (isOpen ? 'Open Stay' : fmtDate(booking.expected_check_out)))}
                  </p>
                </div>
              </div>

              {/* ── GUEST DETAILS ──────────────────────────────────────── */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Primary Guest
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold mb-0.5">Full Name</p>
                    <p className="text-slate-900 dark:text-white font-bold">{booking.guest_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold mb-0.5">Phone</p>
                    <p className="text-slate-700 dark:text-slate-300">{booking.guest_phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold mb-0.5">Address</p>
                    <p className="text-slate-700 dark:text-slate-300 text-xs">{booking.guest_address || '—'}</p>
                  </div>
                </div>
                <div className="pt-1">
                  <p className="text-[10px] text-slate-500 font-semibold mb-0.5">ID / Document Reference</p>
                  <p className="text-xs text-indigo-300 font-medium">
                    {booking.guest_drive_link ? 'ID Documents: Verified & Uploaded on file' : 'Reference: Presented at counter (physical)'}
                  </p>
                </div>

                {/* Guest Signature */}
                <div className="pt-3 flex items-end gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-semibold mb-4">Guest Signature</p>
                    <div className="print-signature-line border-t border-slate-300 dark:border-slate-700 pt-1">
                      <p className="text-[9px] text-slate-600">(Signature)</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-semibold mb-4">Date</p>
                    <div className="print-signature-line border-t border-slate-300 dark:border-slate-700 pt-1">
                      <p className="text-[9px] text-slate-600">(Date)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── COMPANION GUESTS ───────────────────────────────────── */}
              {booking.companions && booking.companions.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> Companion Guests ({booking.companions.length})
                  </p>
                  <table className="print-table w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 px-3 text-left text-[9px] uppercase tracking-wider text-slate-500 font-black">#</th>
                        <th className="py-2 px-3 text-left text-[9px] uppercase tracking-wider text-slate-500 font-black">Name</th>
                        <th className="py-2 px-3 text-left text-[9px] uppercase tracking-wider text-slate-500 font-black">Phone</th>
                        <th className="py-2 px-3 text-left text-[9px] uppercase tracking-wider text-slate-500 font-black">Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {booking.companions.map((c, i) => (
                        <tr key={i} className="border-b border-slate-200 dark:border-slate-800/60">
                          <td className="py-2 px-3 text-slate-500 font-mono">{i + 1}</td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-semibold">{c.full_name}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{c.phone_number || '—'}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-[10px]">{c.address || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── BILLING SUMMARY ────────────────────────────────────── */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
                  <IndianRupee className="w-3 h-3" /> Billing Summary
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Room Rate</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">₹{parseFloat(booking.room_rate || 0).toLocaleString('en-IN')}/night</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Nights</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{typeof nights === 'number' ? nights : '—'}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">Total Amount</span>
                    <span className="text-slate-900 dark:text-white font-bold text-base">₹{parseFloat(booking.total_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400 font-semibold">Advance Paid</span>
                    <span className="text-emerald-400 font-bold">₹{parseFloat(booking.advance_paid || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                    <span className={`font-bold ${pending > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {pending > 0 ? 'Balance Due' : 'Settled'}
                    </span>
                    <span className={`font-black text-base ${pending > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      ₹{Math.abs(pending).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── RECEPTIONIST SIGNATURE ─────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold mb-6">Receptionist Signature</p>
                  <div className="print-signature-line border-t border-slate-300 dark:border-slate-700 pt-1">
                    <p className="text-[9px] text-slate-600">(Authorised Signatory)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-semibold mb-6">Hotel Stamp</p>
                  <div className="border border-dashed border-slate-300 dark:border-slate-700 h-12 rounded-lg flex items-center justify-center">
                    <p className="text-[9px] text-slate-700">STAMP</p>
                  </div>
                </div>
              </div>

              {/* ── TERMS ──────────────────────────────────────────────── */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <p className="text-[9px] text-slate-600 leading-relaxed">
                  <span className="font-bold text-slate-500">Terms:</span> Check-out time is 11:00 AM. Late check-out subject to additional charges. The hotel is not responsible for loss of valuables.
                  Please retain this slip until check-out.
                </p>
              </div>

              {/* ── FOOTER ─────────────────────────────────────────────── */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 text-center">
                <p className="text-[9px] text-slate-600">
                  by <span className="font-bold text-slate-500">HotelNex</span>{' '}
                  <span className="text-slate-700">powered by</span>{' '}
                  <span className="font-bold text-indigo-400">vayunex solution</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
};

export default InvoiceModal;
