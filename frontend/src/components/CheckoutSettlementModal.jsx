import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import {
  X, Check, LogOut, Loader2, AlertCircle, CheckCircle2,
  IndianRupee, CreditCard, QrCode, Banknote, Building2,
  Calendar, FileText, Plus, Trash2, ShieldAlert, Sparkles,
  ArrowRightLeft, Printer, Clock, User, Phone, BedDouble
} from 'lucide-react';

const PAYMENT_MODES = [
  { id: 'Cash',          label: 'Cash',          icon: Banknote,  colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25' },
  { id: 'UPI',           label: 'UPI / QR',      icon: QrCode,    colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/25'   },
  { id: 'Card',          label: 'Card / POS',    icon: CreditCard, colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/25'       },
  { id: 'Bank_Transfer', label: 'Bank Transfer', icon: Building2, colorClass: 'text-purple-500 bg-purple-500/10 border-purple-500/25'  },
  { id: 'Other',         label: 'Other',         icon: FileText,  colorClass: 'text-slate-500 bg-slate-500/10 border-slate-500/25'      },
];

export default function CheckoutSettlementModal({ isOpen, onClose, bookingId, onSuccess, onOpenInvoice }) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [strategy, setStrategy] = useState('full'); // 'full', 'split', 'khata', 'discount'
  
  // Single Full Payment
  const [fullMode, setFullMode] = useState('Cash');
  const [fullRef, setFullRef] = useState('');
  const [fullNotes, setFullNotes] = useState('');

  // Split Payment
  const [splits, setSplits] = useState([
    { mode: 'Cash', amount: '', transaction_ref: '' },
    { mode: 'UPI', amount: '', transaction_ref: '' }
  ]);

  // Credit Khata (Debtor)
  const [dueDate, setDueDate] = useState('');
  const [debtorName, setDebtorName] = useState('');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [khataNotes, setKhataNotes] = useState('');

  // Discount / Waiver
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchPreview();
      setStrategy('full');
      setFullMode('Cash');
      setFullRef('');
      setFullNotes('');
      setDueDate('');
      setDiscountAmount('');
      setDiscountReason('');
      setError('');
      setSuccessData(null);
    }
  }, [isOpen, bookingId]);

  const fetchPreview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/bookings/checkout-preview/${bookingId}`);
      if (res.data?.success) {
        setPreview(res.data.data);
        setDebtorName(res.data.data.guestName || '');
        setDebtorPhone(res.data.data.guestPhone || '');
        // Initialize splits
        const bal = res.data.data.balanceDue;
        if (bal > 0) {
          setSplits([
            { mode: 'Cash', amount: Math.floor(bal / 2).toString(), transaction_ref: '' },
            { mode: 'UPI', amount: (bal - Math.floor(bal / 2)).toString(), transaction_ref: '' }
          ]);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to calculate checkout balance.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const balanceDue = preview ? preview.balanceDue : 0;
  const isZeroBalance = balanceDue <= 0;

  // Calculate remaining balance for split payments
  const totalSplits = splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
  const splitRemaining = balanceDue - totalSplits;

  const addSplitRow = () => {
    setSplits(prev => [...prev, { mode: 'Cash', amount: '', transaction_ref: '' }]);
  };

  const removeSplitRow = (idx) => {
    setSplits(prev => prev.filter((_, i) => i !== idx));
  };

  const updateSplitRow = (idx, field, value) => {
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleCheckoutSubmit = async () => {
    setSubmitting(true);
    setError('');

    let payload = {
      settlement_strategy: strategy,
      idempotency_key: `chk_${bookingId}_${Date.now()}`
    };

    if (isZeroBalance) {
      payload.settlement_strategy = 'zero_balance';
    } else if (strategy === 'full') {
      payload.payments = [
        {
          mode: fullMode,
          amount: balanceDue,
          transaction_ref: fullRef.trim(),
          notes: fullNotes.trim()
        }
      ];
    } else if (strategy === 'split') {
      if (Math.abs(splitRemaining) > 0.01) {
        setError(`Split amounts sum (₹${totalSplits}) must exactly equal balance due (₹${balanceDue}). Remaining: ₹${splitRemaining.toFixed(2)}`);
        setSubmitting(false);
        return;
      }
      payload.payments = splits.map(s => ({
        mode: s.mode,
        amount: parseFloat(s.amount),
        transaction_ref: s.transaction_ref?.trim() || null
      }));
    } else if (strategy === 'khata') {
      payload.settlement_strategy = 'credit_khata';
      payload.receivable = {
        due_date: dueDate || null,
        debtor_name: debtorName.trim(),
        debtor_phone: debtorPhone.trim(),
        notes: khataNotes.trim()
      };
      payload.settlement_notes = `Credit Khata: ${khataNotes.trim() || 'Payment deferred'}`;
    } else if (strategy === 'discount') {
      const dAmt = parseFloat(discountAmount);
      if (isNaN(dAmt) || dAmt <= 0) {
        setError('Please enter a valid discount amount.');
        setSubmitting(false);
        return;
      }
      if (!discountReason.trim()) {
        setError('Discount / Waiver reason is mandatory.');
        setSubmitting(false);
        return;
      }
      payload.discount = {
        amount: dAmt,
        reason: discountReason.trim()
      };
      if (dAmt < balanceDue) {
        // Collect remainder in cash or prompt
        payload.payments = [
          {
            mode: fullMode,
            amount: balanceDue - dAmt,
            transaction_ref: fullRef.trim()
          }
        ];
      }
    }

    try {
      const res = await api.post(`/bookings/checkout/${bookingId}`, payload);
      if (res.data?.success) {
        setSuccessData(res.data.checkoutDetails);
        if (onSuccess) onSuccess(res.data.checkoutDetails);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Check-out settlement failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-sm">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Guest Check-Out &amp; Payment Settlement
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Room <span className="font-bold text-rose-600 dark:text-rose-400">{preview?.roomNumber || '…'}</span> · Guest: <span className="font-bold text-slate-800 dark:text-slate-200">{preview?.guestName || '…'}</span>
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

        {/* ── BODY ─────────────────────────────────────────────────────────── */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-white dark:bg-slate-900">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Calculating authoritative bill &amp; stay balance...</p>
            </div>
          ) : successData ? (
            /* ── SUCCESS VIEW ── */
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Check-Out Succeeded!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  Room {preview?.roomNumber} has been released to <strong>Available</strong> and financial records are logged.
                </p>
              </div>

              {successData.remainingUnpaid > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 max-w-md mx-auto text-left space-y-1 text-xs">
                  <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Credit Khata Created (Receivable)
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Outstanding balance of <strong>₹{successData.remainingUnpaid.toLocaleString('en-IN')}</strong> transferred to Debtors Ledger.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-3">
                {onOpenInvoice && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenInvoice(bookingId);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Print Final Invoice
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Done &amp; Close
                </button>
              </div>
            </div>
          ) : (
            /* ── BILL CALCULATION & SETTLEMENT STRATEGY ── */
            <>
              {/* Bill Overview Grid */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Stay &amp; Charges Breakdown</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {preview?.nightsStayed} night(s) stay
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Daily Rate</p>
                    <p className="text-slate-900 dark:text-white font-bold">₹{preview?.dailyRate?.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Gross Charges</p>
                    <p className="text-slate-900 dark:text-white font-bold">₹{preview?.grossCharges?.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Paid So Far</p>
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold">− ₹{preview?.totalPaidSoFar?.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Discounts / Waivers</p>
                    <p className="text-purple-600 dark:text-purple-400 font-bold">− ₹{preview?.totalDiscounts?.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Final Net Balance Banner */}
                <div className={`rounded-xl p-3.5 flex items-center justify-between border ${
                  isZeroBalance 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400' 
                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
                }`}>
                  <span className="font-bold text-xs uppercase tracking-wider">
                    {isZeroBalance ? 'Bill Status: Fully Settled' : 'Net Outstanding Balance Due'}
                  </span>
                  <span className="text-xl font-black">
                    ₹{balanceDue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* ── SETTLEMENT TABS (Only if balance > 0) ── */}
              {!isZeroBalance && (
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                    Choose Settlement Method
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'full',     label: '💵 Collect Full', sub: 'Single mode'     },
                      { id: 'split',    label: '🔀 Split Payment', sub: 'Cash + UPI + Card' },
                      { id: 'khata',    label: '📝 Credit Khata', sub: 'Pay later debtor'  },
                      { id: 'discount', label: '🏷️ Discount / Waiver', sub: 'Waive charges' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStrategy(tab.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          strategy === tab.id
                            ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/30 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{tab.label}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{tab.sub}</p>
                      </button>
                    ))}
                  </div>

                  {/* ── TAB 1: FULL PAYMENT ── */}
                  {strategy === 'full' && (
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5">
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Select Payment Mode</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {PAYMENT_MODES.slice(0, 4).map(m => {
                            const Icon = m.icon;
                            const isSelected = fullMode === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setFullMode(m.id)}
                                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border-indigo-500'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <Icon className="w-5 h-5 mx-auto mb-1" />
                                <span className="text-xs font-bold block">{m.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                            Reference / UTR / Auth Code (Optional)
                          </label>
                          <input
                            type="text"
                            value={fullRef}
                            onChange={(e) => setFullRef(e.target.value)}
                            placeholder={fullMode === 'UPI' ? 'UPI UTR / Trans ID' : fullMode === 'Card' ? 'Card Last 4 / Auth Code' : 'Ref number'}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                            Staff Notes (Optional)
                          </label>
                          <input
                            type="text"
                            value={fullNotes}
                            onChange={(e) => setFullNotes(e.target.value)}
                            placeholder="e.g. Settled at counter"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── TAB 2: SPLIT PAYMENT ── */}
                  {strategy === 'split' && (
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Split Payment Entries</span>
                        <span className={`text-xs font-black ${splitRemaining === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {splitRemaining === 0 ? '✓ Matched Exactly' : `Remaining: ₹${splitRemaining.toFixed(2)}`}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {splits.map((s, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={s.mode}
                              onChange={(e) => updateSplitRow(idx, 'mode', e.target.value)}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 w-32"
                            >
                              <option value="Cash">Cash</option>
                              <option value="UPI">UPI / QR</option>
                              <option value="Card">Card</option>
                              <option value="Bank_Transfer">Bank Transfer</option>
                            </select>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Amount (₹)"
                              value={s.amount}
                              onChange={(e) => updateSplitRow(idx, 'amount', e.target.value)}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 w-32 font-bold"
                            />

                            <input
                              type="text"
                              placeholder="UTR / Ref / Note"
                              value={s.transaction_ref}
                              onChange={(e) => updateSplitRow(idx, 'transaction_ref', e.target.value)}
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                            />

                            {splits.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSplitRow(idx)}
                                className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-100 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={addSplitRow}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1.5 pt-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Another Split Payment
                      </button>
                    </div>
                  )}

                  {/* ── TAB 3: CREDIT KHATA (DEBTOR) ── */}
                  {strategy === 'khata' && (
                    <div className="bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>Allow Unpaid Check-Out &amp; Move to Debtors Khata</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                            Debtor / Company Name
                          </label>
                          <input
                            type="text"
                            value={debtorName}
                            onChange={(e) => setDebtorName(e.target.value)}
                            placeholder="Guest / Company"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                            Contact Phone
                          </label>
                          <input
                            type="text"
                            value={debtorPhone}
                            onChange={(e) => setDebtorPhone(e.target.value)}
                            placeholder="Phone Number"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                            Promised Due Date
                          </label>
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                          Reason / Guarantee Notes
                        </label>
                        <input
                          type="text"
                          value={khataNotes}
                          onChange={(e) => setKhataNotes(e.target.value)}
                          placeholder="e.g. Corporate billing / Guest promised payment via NEFT tomorrow"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* ── TAB 4: DISCOUNT / WAIVER ── */}
                  {strategy === 'discount' && (
                    <div className="bg-purple-50/60 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/20 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-400">
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>Manager Approved Bill Discount / Waiver</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                            Discount Amount to Waive (Max: ₹{balanceDue})
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={balanceDue}
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(e.target.value)}
                            placeholder="Discount in ₹"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                            Mandatory Approval Reason
                          </label>
                          <input
                            type="text"
                            value={discountReason}
                            onChange={(e) => setDiscountReason(e.target.value)}
                            placeholder="e.g. Courtesy round-off approved by GM"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </>
          )}
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        {!successData && !loading && (
          <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCheckoutSubmit}
              disabled={submitting || (!isZeroBalance && strategy === 'split' && Math.abs(splitRemaining) > 0.01)}
              className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isZeroBalance 
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                  : strategy === 'khata'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
              }`}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting 
                ? 'Processing Settlement...' 
                : isZeroBalance 
                ? 'Confirm & Release Room' 
                : strategy === 'khata'
                ? 'Check-Out (Defer to Khata)'
                : `Settle ₹${balanceDue.toLocaleString('en-IN')} & Check-Out`}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
