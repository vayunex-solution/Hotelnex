import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api.js';
import {
  IndianRupee, TrendingUp, Banknote, QrCode, CreditCard, Building2,
  Calendar, Download, Search, Filter, RefreshCw, AlertCircle,
  CheckCircle2, ArrowDownRight, ArrowUpRight, ShieldAlert,
  Sparkles, Lock, Unlock, FileText, ChevronLeft, ChevronRight,
  Clock, User, Phone, BedDouble, Check, X, Printer
} from 'lucide-react';
import CollectDebtorModal from '../../components/CollectDebtorModal.jsx';
import CashDrawerModal from '../../components/CashDrawerModal.jsx';

export default function Finance() {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger', 'debtors', 'drawer'
  const [period, setPeriod] = useState('month'); // 'today', 'yesterday', 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Summary KPIs
  const [summary, setSummary] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Transactions Ledger State
  const [transactions, setTransactions] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTxns, setTotalTxns] = useState(0);
  const [searchLedger, setSearchLedger] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterType, setFilterType] = useState('');

  // Debtors Khata State
  const [debtors, setDebtors] = useState([]);
  const [loadingDebtors, setLoadingDebtors] = useState(false);
  const [searchDebtors, setSearchDebtors] = useState('');
  const [filterDebtorStatus, setFilterDebtorStatus] = useState('all');
  const [selectedDebtor, setSelectedDebtor] = useState(null);

  // Cash Drawer Modal
  const [isDrawerModalOpen, setIsDrawerModalOpen] = useState(false);

  // Fetch summary metrics
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      let url = `/finance/summary?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const res = await api.get(url);
      if (res.data?.success) {
        setSummary(res.data.data.summary);
        setActiveDrawer(res.data.data.activeCashDrawer);
      }
    } catch (err) {
      console.error('Failed to fetch finance summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [period, startDate, endDate]);

  // Fetch transaction ledger
  const fetchTransactions = useCallback(async () => {
    setLoadingLedger(true);
    try {
      let url = `/finance/transactions?page=${page}&limit=15`;
      if (filterMode) url += `&payment_mode=${filterMode}`;
      if (filterType) url += `&payment_type=${filterType}`;
      if (searchLedger.trim()) url += `&search=${encodeURIComponent(searchLedger.trim())}`;
      if (period === 'today' || period === 'yesterday' || period === 'week' || period === 'month') {
        // Can optionally pass date bounds if wanted
      }
      if (period === 'custom' && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }

      const res = await api.get(url);
      if (res.data?.success) {
        setTransactions(res.data.data);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalTxns(res.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, [page, filterMode, filterType, searchLedger, period, startDate, endDate]);

  // Fetch Debtors
  const fetchDebtors = useCallback(async () => {
    setLoadingDebtors(true);
    try {
      let url = `/finance/debtors?status=${filterDebtorStatus}`;
      if (searchDebtors.trim()) url += `&search=${encodeURIComponent(searchDebtors.trim())}`;
      const res = await api.get(url);
      if (res.data?.success) {
        setDebtors(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch debtors:', err);
    } finally {
      setLoadingDebtors(false);
    }
  }, [filterDebtorStatus, searchDebtors]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchTransactions();
    } else if (activeTab === 'debtors') {
      fetchDebtors();
    }
  }, [activeTab, fetchTransactions, fetchDebtors]);

  const [exportingCSV, setExportingCSV] = useState(false);

  // Export CSV via authenticated Axios request with Blob download
  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const params = {};
      if (filterMode) params.payment_mode = filterMode;
      if (filterType) params.payment_type = filterType;
      if (period === 'custom' && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }

      const response = await api.get('/finance/export', {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hotelnex_finance_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('Failed to export CSV: ' + (err.response?.data?.message || err.message));
    } finally {
      setExportingCSV(false);
    }
  };

  const getModeBadge = (mode) => {
    switch (mode) {
      case 'Cash':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><Banknote className="w-3 h-3" /> Cash</span>;
      case 'UPI':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"><QrCode className="w-3 h-3" /> UPI</span>;
      case 'Card':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"><CreditCard className="w-3 h-3" /> Card</span>;
      case 'Bank_Transfer':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"><Building2 className="w-3 h-3" /> Bank Transfer</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">{mode}</span>;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'Advance':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Advance</span>;
      case 'Checkout_Settlement':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Settlement</span>;
      case 'Post_Checkout_Due':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Khata Recovery</span>;
      case 'Refund':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Refund</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">{type}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto min-h-screen">

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Finance &amp; Revenue Ledger
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Real-time
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Authoritative financial transaction ledger, payment collections, credit khata &amp; cash drawer reconciliation.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period Filter */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Date</option>
          </select>

          {period === 'custom' && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 shadow-sm">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          )}

          {/* Cash Drawer Button */}
          <button
            type="button"
            onClick={() => setIsDrawerModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              activeDrawer 
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
            }`}
          >
            {activeDrawer ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{activeDrawer ? 'Shift Drawer: OPEN' : 'Open Cash Drawer'}</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            disabled={exportingCSV}
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className={`w-3.5 h-3.5 ${exportingCSV ? 'animate-bounce' : ''}`} />
            <span>{exportingCSV ? 'Exporting…' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Collections */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span className="uppercase tracking-wider">Net Collections</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            ₹{summary ? summary.netCollections.toLocaleString('en-IN') : '0.00'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Gross: ₹{summary?.grossCollections?.toLocaleString('en-IN') || '0'}</span>
            {summary?.totalRefunds > 0 && <span className="text-rose-500">· Refunds: −₹{summary.totalRefunds}</span>}
          </div>
        </div>

        {/* Cash in Hand / Collections */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span className="uppercase tracking-wider">Cash Collected</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ₹{summary ? summary.cashCollected.toLocaleString('en-IN') : '0.00'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {activeDrawer ? `Expected in Drawer: ₹${parseFloat(activeDrawer.expected_cash || 0).toLocaleString('en-IN')}` : 'Drawer closed'}
          </div>
        </div>

        {/* UPI & Digital Collections */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span className="uppercase tracking-wider">UPI &amp; Card (Digital)</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
            ₹{summary ? (summary.upiCollected + summary.cardCollected + summary.bankCollected).toLocaleString('en-IN') : '0.00'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            UPI: ₹{summary?.upiCollected?.toLocaleString('en-IN') || 0} · Card: ₹{summary?.cardCollected?.toLocaleString('en-IN') || 0}
          </div>
        </div>

        {/* Outstanding Receivables (Credit Khata) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span className="uppercase tracking-wider">Credit Khata (Debtors)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
            ₹{summary ? summary.totalOutstanding.toLocaleString('en-IN') : '0.00'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {summary?.activeDebtorsCount || 0} active unpaid debtor account(s)
          </div>
        </div>
      </div>

      {/* ── TABS NAVIGATION ──────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'ledger'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Transactions Ledger ({totalTxns})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('debtors')}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'debtors'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Credit Khata &amp; Debtors ({debtors.length})</span>
        </button>
      </div>

      {/* ── TAB 1: IMMUTABLE TRANSACTIONS LEDGER ─────────────────────────────── */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search guest, phone, room #, ref UTR..."
                value={searchLedger}
                onChange={(e) => {
                  setSearchLedger(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterMode}
                onChange={(e) => {
                  setFilterMode(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="">All Payment Modes</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / QR</option>
                <option value="Card">Card</option>
                <option value="Bank_Transfer">Bank Transfer</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="">All Transaction Types</option>
                <option value="Advance">Advance</option>
                <option value="Checkout_Settlement">Checkout Settlement</option>
                <option value="Post_Checkout_Due">Khata Recovery</option>
                <option value="Refund">Refund</option>
              </select>

              <button
                type="button"
                onClick={fetchTransactions}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Txn Ref</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Guest &amp; Room</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Ref / UTR</th>
                    <th className="py-3 px-4">Collected By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                  {loadingLedger ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                        Loading immutable financial ledger...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No financial transactions found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          #TXN-{txn.id}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(txn.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                            {txn.guest_name || 'Guest'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            Room {txn.room_number || '—'} · {txn.guest_phone || '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getTypeBadge(txn.payment_type)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getModeBadge(txn.payment_mode)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <span className={txn.payment_type === 'Refund' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {txn.payment_type === 'Refund' ? '− ' : '+ '}₹{parseFloat(txn.amount).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 truncate max-w-[120px]">
                          {txn.transaction_ref || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 truncate max-w-[130px]">
                          {txn.collected_by_name || 'Staff'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="py-3 px-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Page {page} of {totalPages} ({totalTxns} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: CREDIT KHATA & DEBTORS ────────────────────────────────────── */}
      {activeTab === 'debtors' && (
        <div className="space-y-4">
          {/* Debtors Search & Filter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search debtor name, phone, room #..."
                value={searchDebtors}
                onChange={(e) => setSearchDebtors(e.target.value)}
                className="bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterDebtorStatus}
                onChange={(e) => setFilterDebtorStatus(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">Active Debtors (Unpaid &amp; Partial)</option>
                <option value="open">Open (Unpaid)</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="settled">Settled (Archived)</option>
              </select>

              <button
                type="button"
                onClick={fetchDebtors}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Debtors Cards / Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Debtor / Guest</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Room #</th>
                    <th className="py-3 px-4">Original Amount</th>
                    <th className="py-3 px-4">Paid So Far</th>
                    <th className="py-3 px-4">Outstanding Due</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                  {loadingDebtors ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                        Loading credit khata accounts...
                      </td>
                    </tr>
                  ) : debtors.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        No outstanding debtor accounts found.
                      </td>
                    </tr>
                  ) : (
                    debtors.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {d.debtor_name || 'Guest'}
                          </div>
                          {d.notes && <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{d.notes}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {d.debtor_phone || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                          Room {d.room_number || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                          ₹{parseFloat(d.original_amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-bold">
                          ₹{parseFloat(d.paid_amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 font-black text-rose-600 dark:text-rose-400">
                          ₹{parseFloat(d.outstanding_amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {d.due_date ? new Date(d.due_date).toLocaleDateString('en-IN') : 'No date'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {d.status === 'open' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">Unpaid</span>
                          ) : d.status === 'partially_paid' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">Partial</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Settled</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {d.status !== 'settled' && (
                            <button
                              type="button"
                              onClick={() => setSelectedDebtor(d)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow transition-all cursor-pointer"
                            >
                              Collect Due
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      {selectedDebtor && (
        <CollectDebtorModal
          isOpen={!!selectedDebtor}
          onClose={() => setSelectedDebtor(null)}
          debtor={selectedDebtor}
          onSuccess={() => {
            fetchDebtors();
            fetchSummary();
          }}
        />
      )}

      {isDrawerModalOpen && (
        <CashDrawerModal
          isOpen={isDrawerModalOpen}
          onClose={() => setIsDrawerModalOpen(false)}
          activeDrawer={activeDrawer}
          onActionSuccess={() => {
            fetchSummary();
          }}
        />
      )}

    </div>
  );
}
