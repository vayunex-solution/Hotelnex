import React, { useState } from 'react';
import api from '../services/api.js';
import {
  X, Check, Loader2, AlertCircle, CheckCircle2,
  Banknote, QrCode, CreditCard, Building2, FileText,
  IndianRupee, User, Phone, ShieldCheck
} from 'lucide-react';

const PAYMENT_MODES = [
  { id: 'Cash',          label: 'Cash',          icon: Banknote   },
  { id: 'UPI',           label: 'UPI / QR',      icon: QrCode     },
  { id: 'Card',          label: 'Card / POS',    icon: CreditCard },
  { id: 'Bank_Transfer', label: 'Bank Transfer', icon: Building2  },
];

export default function CollectDebtorModal({ isOpen, onClose, debtor, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !debtor) return null;

  const outstanding = parseFloat(debtor.outstanding_amount) || 0;

  const handleFullAmount = () => {
    setAmount(outstanding.toString());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payAmt = parseFloat(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    if (payAmt > outstanding) {
      setError(`Payment amount cannot exceed outstanding balance (₹${outstanding.toLocaleString('en-IN')}).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/finance/debtors/${debtor.id}/collect`, {
        amount: payAmt,
        payment_mode: paymentMode,
        transaction_ref: transactionRef.trim() || null,
        notes: notes.trim() || null,
        idempotency_key: `dbt_${debtor.id}_${Date.now()}`
      });

      if (res.data?.success) {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Payment collection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Collect Khata Payment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Debtor: <span className="font-bold text-slate-800 dark:text-slate-200">{debtor.debtor_name}</span> (Room {debtor.room_number || '—'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── BODY ─────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Balance card */}
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Total Outstanding Due</p>
              <p className="text-2xl font-black text-amber-800 dark:text-amber-300">₹{outstanding.toLocaleString('en-IN')}</p>
            </div>
            <button
              type="button"
              onClick={handleFullAmount}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow transition-all cursor-pointer"
            >
              Pay Full ₹{outstanding.toLocaleString('en-IN')}
            </button>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Amount to Collect (₹) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max={outstanding}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Enter amount up to ₹${outstanding}`}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Payment Mode Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Payment Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_MODES.map(m => {
                const Icon = m.icon;
                const isSelected = paymentMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMode(m.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-[11px] font-bold block">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                UTR / Auth Reference (Optional)
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g. UTR / Receipt Ref"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Collection Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Received via GPay"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? 'Recording Payment...' : `Collect ₹${parseFloat(amount || 0).toLocaleString('en-IN')}`}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
