import React, { useState } from 'react';
import api from '../services/api.js';
import {
  X, Check, Loader2, AlertCircle, CheckCircle2,
  Banknote, ArrowDownRight, ArrowUpRight, ShieldAlert,
  Clock, Lock, Unlock, IndianRupee, FileText
} from 'lucide-react';

export default function CashDrawerModal({ isOpen, onClose, activeDrawer, onActionSuccess }) {
  const [openingBalance, setOpeningBalance] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isDrawerOpen = !!activeDrawer;
  const expectedCash = isDrawerOpen ? parseFloat(activeDrawer.expected_cash || 0) : 0;
  const variance = actualCash !== '' ? parseFloat(actualCash || 0) - expectedCash : 0;

  const handleOpenDrawer = async (e) => {
    e.preventDefault();
    setError('');
    const openBal = parseFloat(openingBalance) || 0;

    setSubmitting(true);
    try {
      const res = await api.post('/finance/cash-drawer/open', {
        opening_balance: openBal
      });
      if (res.data?.success) {
        if (onActionSuccess) onActionSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to open cash drawer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDrawer = async (e) => {
    e.preventDefault();
    setError('');

    const countedCash = parseFloat(actualCash);
    if (isNaN(countedCash) || countedCash < 0) {
      setError('Please enter the physical cash counted in drawer.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/finance/cash-drawer/close', {
        actual_cash: countedCash,
        closing_notes: closingNotes.trim() || null
      });
      if (res.data?.success) {
        if (onActionSuccess) onActionSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close cash drawer.');
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
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              isDrawerOpen 
                ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' 
                : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              {isDrawerOpen ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {isDrawerOpen ? 'Close Shift Cash Drawer' : 'Open Front-Desk Cash Drawer'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isDrawerOpen ? 'Reconcile cash counted vs system expected' : 'Initialize opening cash float for this shift'}
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
        <div className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isDrawerOpen ? (
            /* ── OPEN DRAWER FORM ── */
            <form onSubmit={handleOpenDrawer} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Starting Float / Opening Balance (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="e.g. 2000.00"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Leave 0 if starting with an empty cash drawer.
                </p>
              </div>

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
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  {submitting ? 'Opening Drawer...' : 'Open Cash Drawer'}
                </button>
              </div>
            </form>
          ) : (
            /* ── CLOSE DRAWER FORM ── */
            <form onSubmit={handleCloseDrawer} className="space-y-4">
              {/* Summary Stats */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Opening Float:</span>
                  <span className="font-bold text-slate-900 dark:text-white">₹{parseFloat(activeDrawer.opening_balance || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Cash Collections Today:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+ ₹{parseFloat(activeDrawer.cash_collections || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Cash Refunds:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">− ₹{parseFloat(activeDrawer.cash_refunds || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-black text-sm">
                  <span className="text-slate-900 dark:text-white">Expected Cash in Drawer:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">₹{expectedCash.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Physical Cash Counted in Drawer (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder={`Expected: ₹${expectedCash}`}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {actualCash !== '' && (
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  variance === 0 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : variance > 0
                    ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'
                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
                }`}>
                  <span>Variance (Discrepancy):</span>
                  <span className="text-sm">
                    {variance === 0 ? '✓ Exact Match (₹0)' : `${variance > 0 ? '+ Excess' : '− Shortage'} ₹${Math.abs(variance).toLocaleString('en-IN')}`}
                  </span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Closing Notes &amp; Handover Details (Optional)
                </label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="e.g. Handed over to evening shift receptionist"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

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
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {submitting ? 'Reconciling & Closing...' : 'Close & Lock Drawer'}
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
