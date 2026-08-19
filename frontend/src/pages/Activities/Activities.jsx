import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api.js';
import {
  Activity, LogIn, LogOut, BedDouble, ArrowRightLeft, UserPlus,
  UserCog, Settings, Trash2, PlusCircle, RefreshCw, Filter,
  Globe, Clock, User, ChevronLeft, ChevronRight, Shield
} from 'lucide-react';

/* ── Action meta map ──────────────────────────────────────────── */
const ACTION_META = {
  LOGIN:           { icon: LogIn,           color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Login'           },
  LOGOUT:          { icon: LogOut,          color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', label: 'Logout'          },
  CHECK_IN:        { icon: BedDouble,       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'Check-In'        },
  CHECK_OUT:       { icon: LogOut,          color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Check-Out'       },
  ROOM_SHIFT:      { icon: ArrowRightLeft,  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Room Shift'      },
  GUEST_CREATE:    { icon: UserPlus,        color: '#34d399', bg: 'rgba(52,211,153,0.10)',  label: 'Guest Added'     },
  GUEST_UPDATE:    { icon: UserCog,         color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  label: 'Guest Updated'   },
  ROOM_CREATE:     { icon: PlusCircle,      color: '#2dd4bf', bg: 'rgba(45,212,191,0.10)',  label: 'Room Created'    },
  ROOM_UPDATE:     { icon: Settings,        color: '#fb923c', bg: 'rgba(251,146,60,0.10)',  label: 'Room Updated'    },
  ROOM_DELETE:     { icon: Trash2,          color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Room Deleted'    },
  SETTINGS_UPDATE: { icon: Settings,        color: '#818cf8', bg: 'rgba(129,140,248,0.10)', label: 'Settings Changed' },
  CREATE:          { icon: PlusCircle,      color: '#34d399', bg: 'rgba(52,211,153,0.10)',  label: 'Created'         },
  UPDATE:          { icon: UserCog,         color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  label: 'Updated'         },
  DELETE:          { icon: Trash2,          color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Deleted'         },
  ACTION:          { icon: Activity,        color: '#64748b', bg: 'rgba(100,116,139,0.08)', label: 'Action'          },
};

const getMeta = (action) => ACTION_META[action] || ACTION_META.ACTION;

const STATUS_COLOR = (code) => {
  if (code >= 500) return '#f87171';
  if (code >= 400) return '#fbbf24';
  if (code >= 200) return '#34d399';
  return '#64748b';
};

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};

const timeAgo = (ts) => {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const ACTION_FILTERS = [
  { value: '', label: 'All Activity' },
  { value: 'CHECK_IN', label: 'Check-Ins' },
  { value: 'CHECK_OUT', label: 'Check-Outs' },
  { value: 'ROOM_SHIFT', label: 'Room Shifts' },
  { value: 'GUEST_CREATE', label: 'Guests Added' },
  { value: 'LOGIN', label: 'Logins' },
  { value: 'SETTINGS_UPDATE', label: 'Settings' },
];

export default function Activities() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
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

  useEffect(() => { fetchLogs(page, filter); }, [page, filter, fetchLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs(page, filter);
  };

  const handleFilterChange = (val) => {
    setFilter(val);
    setPage(1);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ background: '#080a12' }}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 0 18px rgba(99,102,241,0.2)' }}>
                <Activity className="w-4 h-4" style={{ color: '#818cf8' }} />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Activity Log</h1>
              <div className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                {total.toLocaleString()} events
              </div>
            </div>
            <p className="text-xs ml-12" style={{ color: '#475569' }}>Complete audit trail — all staff actions with IP addresses</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 cursor-pointer self-start sm:self-auto"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Filter Pills ─────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {ACTION_FILTERS.map(f => {
            const isActive = filter === f.value;
            return (
              <button key={f.value} onClick={() => handleFilterChange(f.value)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer hover:scale-105"
                style={isActive
                  ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#475569' }}>
                {f.label}
              </button>
            );
          })}
        </div>

        {/* ── Stats Row ────────────────────────────────────── */}
        {!loading && logs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Events', value: total, icon: Activity, color: '#818cf8' },
              { label: 'Unique IPs', value: [...new Set(logs.map(l => l.ip_address))].length, icon: Globe, color: '#60a5fa' },
              { label: 'This Page', value: logs.length, icon: Filter, color: '#34d399' },
              { label: 'Page', value: `${page} / ${totalPages}`, icon: Shield, color: '#fb923c' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="p-3.5 rounded-xl flex items-center gap-3"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}25` }}>
                    <Icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-base font-black" style={{ color: '#f1f5f9' }}>{stat.value}</p>
                    <p className="text-[10px]" style={{ color: '#334155' }}>{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Table ───────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>

          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#334155' }}>
            <div className="col-span-3">Action</div>
            <div className="col-span-2">User</div>
            <div className="col-span-2">IP Address</div>
            <div className="col-span-2">Path</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Time</div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-2 border-t-indigo-500 border-slate-800 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs" style={{ color: '#334155' }}>Loading activity log...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center">
              <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: '#1e293b' }} />
              <p className="text-sm font-bold" style={{ color: '#334155' }}>No activity yet</p>
              <p className="text-xs mt-1" style={{ color: '#1e293b' }}>Actions like check-in, room shifts, etc. will appear here.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {logs.map((log, idx) => {
                const meta = getMeta(log.action);
                const Icon = meta.icon;
                return (
                  <div key={log.id || idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-white/[0.015] transition-colors group"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}>

                    {/* Action */}
                    <div className="col-span-3 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: meta.bg, border: `1px solid ${meta.color}25` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#e2e8f0' }}>{log.action_label}</p>
                        <p className="text-[9px] sm:hidden" style={{ color: '#475569' }}>{timeAgo(log.created_at)}</p>
                      </div>
                    </div>

                    {/* User */}
                    <div className="col-span-2 flex items-center gap-1.5 sm:pl-0 pl-10">
                      <User className="w-3 h-3 shrink-0" style={{ color: '#334155' }} />
                      <span className="text-[11px] font-semibold truncate" style={{ color: '#94a3b8' }}>{log.user_name}</span>
                    </div>

                    {/* IP */}
                    <div className="col-span-2 flex items-center gap-1.5 sm:pl-0 pl-10">
                      <Globe className="w-3 h-3 shrink-0" style={{ color: '#334155' }} />
                      <span className="text-[10px] font-mono truncate" style={{ color: '#6366f1' }}>{log.ip_address}</span>
                    </div>

                    {/* Path */}
                    <div className="col-span-2 flex items-center sm:pl-0 pl-10">
                      <span className="text-[10px] font-mono truncate" style={{ color: '#334155' }}
                        title={log.request_path}>
                        {log.request_path.length > 28 ? log.request_path.slice(0, 28) + '…' : log.request_path}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-1 flex items-center sm:pl-0 pl-10">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                        style={{ color: STATUS_COLOR(log.status_code), background: `${STATUS_COLOR(log.status_code)}15` }}>
                        {log.status_code}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="col-span-2 hidden sm:flex flex-col justify-center">
                      <p className="text-[10px] font-semibold" style={{ color: '#475569' }}>{timeAgo(log.created_at)}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: '#1e293b' }}>{formatTime(log.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Pagination ──────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: '#334155' }}>
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} events
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = page <= 3 ? i + 1 : page - 2 + i;
                if (pg < 1 || pg > totalPages) return null;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-105"
                    style={pg === page
                      ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#475569' }}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
