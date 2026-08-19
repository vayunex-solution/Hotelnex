import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api.js';
import {
  Activity, LogIn, LogOut, BedDouble, ArrowRightLeft, UserPlus,
  UserCog, Settings, Trash2, PlusCircle, RefreshCw, Filter,
  Globe, Clock, User, ChevronLeft, ChevronRight, Shield
} from 'lucide-react';

/* ── Action meta configuration ────────────────────────────────── */
const ACTION_META = {
  LOGIN:           { icon: LogIn,          colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', label: 'Login'           },
  LOGOUT:          { icon: LogOut,         colorClass: 'text-slate-500 bg-slate-500/10 border-slate-500/20',     label: 'Logout'          },
  CHECK_IN:        { icon: BedDouble,      colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20',        label: 'Check-In'        },
  CHECK_OUT:       { icon: LogOut,         colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20',        label: 'Check-Out'       },
  ROOM_SHIFT:      { icon: ArrowRightLeft, colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',  label: 'Room Shift'      },
  GUEST_CREATE:    { icon: UserPlus,       colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', label: 'Guest Added'   },
  GUEST_UPDATE:    { icon: UserCog,        colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',     label: 'Guest Updated'   },
  ROOM_CREATE:     { icon: PlusCircle,     colorClass: 'text-teal-500 bg-teal-500/10 border-teal-500/20',        label: 'Room Created'    },
  ROOM_UPDATE:     { icon: Settings,       colorClass: 'text-orange-500 bg-orange-500/10 border-orange-500/20',  label: 'Room Updated'    },
  ROOM_DELETE:     { icon: Trash2,         colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20',        label: 'Room Deleted'    },
  SETTINGS_UPDATE: { icon: Settings,       colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',  label: 'Settings Changed'},
  CREATE:          { icon: PlusCircle,     colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', label: 'Created'       },
  UPDATE:          { icon: UserCog,        colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',     label: 'Updated'         },
  DELETE:          { icon: Trash2,         colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20',        label: 'Deleted'         },
  ACTION:          { icon: Activity,       colorClass: 'text-slate-500 bg-slate-500/10 border-slate-500/20',     label: 'Action'          },
};

const getMeta = (action) => ACTION_META[action] || ACTION_META.ACTION;

const getStatusBadge = (code) => {
  if (code >= 500) return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  if (code >= 400) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  if (code >= 200) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
};

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const timeAgo = (ts) => {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const ACTION_FILTERS = [
  { value: '',               label: 'All Activity'   },
  { value: 'CHECK_IN',        label: 'Check-Ins'      },
  { value: 'CHECK_OUT',       label: 'Check-Outs'     },
  { value: 'ROOM_SHIFT',      label: 'Room Shifts'    },
  { value: 'GUEST_CREATE',    label: 'Guests Added'   },
  { value: 'LOGIN',           label: 'Logins'         },
  { value: 'SETTINGS_UPDATE', label: 'Settings'       },
];

export default function Activities() {
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const LIMIT = 20;

  const fetchLogs = useCallback(async (pg = 1, actionFilter = '') => {
    setLoading(true);
    try {
      const params = { page: pg, limit: LIMIT };
      if (actionFilter) params.action = actionFilter;
      const res = await api.get('/activities', { params });
      if (res.data?.success) {
        setLogs(res.data.data || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Activities fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page, filter);
  }, [page, filter, fetchLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs(page, filter);
  };

  const handleFilterChange = (val) => {
    setFilter(val);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-500 shrink-0 shadow-lg shadow-indigo-500/10">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Activity Log</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              {total.toLocaleString()} events
            </span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm ml-0.5">
            Complete real-time audit trail — all staff actions logged with IP address and timestamp
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all self-start sm:self-auto cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── FILTER PILLS ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {ACTION_FILTERS.map(f => {
          const isActive = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ── STATS ROW ───────────────────────────────────────────────────────── */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-white">{total}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Total Events</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-white">{[...new Set(logs.map(l => l.ip_address))].length}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Unique IPs</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-white">{logs.length}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">On Page</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-white">{page} / {totalPages}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Page</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TABLE CONTAINER ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        
        {/* Table Header (Desktop) */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800/40 border-b border-slate-800">
          <div className="col-span-3">Action</div>
          <div className="col-span-2">User / Staff</div>
          <div className="col-span-2">IP Address</div>
          <div className="col-span-2">Endpoint Path</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Time</div>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Loading activity audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center space-y-3 px-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
              <Activity className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">No Activity Logged Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {filter
                ? "No events found matching this filter."
                : "Actions like check-ins, check-outs, room shifts, and guest creations will automatically appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {logs.map((log, idx) => {
              const meta = getMeta(log.action);
              const Icon = meta.icon;
              return (
                <div
                  key={log.id || idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-slate-800/40 transition-colors items-center"
                >
                  {/* Action Column */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">{log.action_label}</p>
                      <p className="text-[10px] text-slate-400 sm:hidden">{timeAgo(log.created_at)}</p>
                    </div>
                  </div>

                  {/* User Column */}
                  <div className="col-span-2 flex items-center gap-2 sm:pl-0 pl-12">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-200 truncate">{log.user_name}</span>
                  </div>

                  {/* IP Column */}
                  <div className="col-span-2 flex items-center gap-2 sm:pl-0 pl-12">
                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs font-mono font-bold text-indigo-400 truncate">{log.ip_address}</span>
                  </div>

                  {/* Path Column */}
                  <div className="col-span-2 flex items-center sm:pl-0 pl-12">
                    <span className="text-xs font-mono text-slate-400 truncate" title={log.request_path}>
                      {log.request_path.length > 26 ? log.request_path.slice(0, 26) + '…' : log.request_path}
                    </span>
                  </div>

                  {/* Status Column */}
                  <div className="col-span-1 flex items-center sm:pl-0 pl-12">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getStatusBadge(log.status_code)}`}>
                      {log.status_code}
                    </span>
                  </div>

                  {/* Timestamp Column */}
                  <div className="col-span-2 hidden sm:block text-right">
                    <p className="text-xs font-bold text-slate-300">{timeAgo(log.created_at)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(log.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PAGINATION ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs font-medium text-slate-400">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} events
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page - 2 + i;
              if (pg < 1 || pg > totalPages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    pg === page
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
