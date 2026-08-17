import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import platformApi from '../../services/platformApi.js';
import { usePlatformTheme } from '../../context/PlatformThemeContext.jsx';
import {
  Building2, Users, Activity, Database, TrendingUp,
  RefreshCw, AlertCircle, CheckCircle2, Clock, Zap
} from 'lucide-react';

// ─── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    healthy:  { label: 'Healthy',  cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
    degraded: { label: 'Degraded', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
    critical: { label: 'Critical', cls: 'bg-red-500/15 text-red-500 border-red-500/30' },
  };
  const { label, cls } = map[status] || map.healthy;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>{label}</span>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const PlatformDashboard = () => {
  const navigate = useNavigate();
  const { isDark } = usePlatformTheme();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await platformApi.get('/dashboard/summary');
      setData(res.data.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, []);

  const { tenants, properties, activeUsers, systemHealth, recentActivity } = data || {};

  // ── Theme tokens ─────────────────────────────────────────────────────────────
  const card    = isDark ? 'bg-[#0e0e1a] border-slate-800/60 hover:border-violet-900/40' : 'bg-white border-slate-200 hover:border-violet-300 shadow-sm';
  const cardTxt = isDark ? 'text-slate-200' : 'text-slate-800';
  const muted   = isDark ? 'text-slate-500' : 'text-slate-400';
  const dimmed  = isDark ? 'text-slate-600' : 'text-slate-300';
  const row     = isDark ? 'bg-slate-900/50' : 'bg-slate-50';
  const rowTxt  = isDark ? 'text-slate-300' : 'text-slate-600';
  const bar     = isDark ? 'bg-slate-800' : 'bg-slate-200';
  const pulse   = isDark ? 'bg-slate-800' : 'bg-slate-200';
  const refreshBtn = isDark
    ? 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-700/50 text-slate-300'
    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600';

  // ── Stat Card ────────────────────────────────────────────────────────────────
  const StatCard = ({ label, value, sub, icon: Icon, color }) => (
    <div className={`border rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 group ${card}`}>
      <div className="flex items-start justify-between">
        <p className={`text-xs font-medium uppercase tracking-wider ${muted}`}>{label}</p>
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <div className={`h-8 w-20 ${pulse} rounded-lg animate-pulse`} />
      ) : (
        <p className={`text-3xl font-bold tracking-tight ${cardTxt}`}>{value ?? '—'}</p>
      )}
      {sub && <p className={`text-xs ${muted}`}>{sub}</p>}
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-screen-xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${cardTxt}`}>Platform Overview</h1>
          <p className={`text-sm mt-0.5 ${muted}`}>
            {lastRefresh
              ? `Last updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Loading platform metrics...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/platform/tenants')}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors duration-200 shadow-lg shadow-violet-500/20"
          >
            <Building2 className="w-4 h-4" />
            Manage Tenants
          </button>
          <button
            onClick={fetchSummary}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-2 border text-sm rounded-xl transition-colors duration-200 disabled:opacity-50 ${refreshBtn}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Primary Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tenants"  value={tenants?.total}    sub={`${tenants?.trial || 0} in trial`}       icon={Building2}    color="bg-violet-500/15 text-violet-500" />
        <StatCard label="Active Tenants" value={tenants?.active}   sub={`${tenants?.suspended || 0} suspended`}  icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-500" />
        <StatCard label="Properties"     value={properties}        sub="Across all tenants"                       icon={TrendingUp}   color="bg-blue-500/15 text-blue-500" />
        <StatCard label="Active Users"   value={activeUsers}       sub="Platform-wide"                            icon={Users}        color="bg-amber-500/15 text-amber-500" />
      </div>

      {/* ── System Health + Tenant Distribution + Recent Activity ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* System Health */}
        <div className={`border rounded-2xl p-5 transition-colors duration-300 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-violet-500" />
            <h2 className={`text-sm font-semibold ${cardTxt}`}>System Health</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`h-10 ${pulse} rounded-lg animate-pulse`} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Database',   icon: Zap,      iconCls: 'text-violet-500',  extra: `${systemHealth?.database?.latencyMs || 0}ms`, status: systemHealth?.database?.status },
                { label: 'API Server', icon: Activity,  iconCls: 'text-emerald-500', extra: null, status: 'healthy' },
                { label: 'Event Bus',  icon: Clock,     iconCls: 'text-blue-500',    extra: null, status: 'healthy' },
              ].map(({ label, icon: Icon, iconCls, extra, status }) => (
                <div key={label} className={`flex items-center justify-between py-2.5 px-3 ${row} rounded-xl`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${iconCls}`} />
                    <span className={`text-xs ${rowTxt}`}>{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {extra && <span className={`text-xs ${muted}`}>{extra}</span>}
                    <StatusBadge status={status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tenant Distribution */}
        <div className={`border rounded-2xl p-5 transition-colors duration-300 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-violet-500" />
            <h2 className={`text-sm font-semibold ${cardTxt}`}>Tenant Distribution</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`h-8 ${pulse} rounded-lg animate-pulse`} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Active',    count: tenants?.active,    color: 'bg-emerald-500', pct: tenants?.total ? Math.round((tenants?.active    / tenants?.total) * 100) : 0 },
                { label: 'Trial',     count: tenants?.trial,     color: 'bg-amber-500',   pct: tenants?.total ? Math.round((tenants?.trial     / tenants?.total) * 100) : 0 },
                { label: 'Suspended', count: tenants?.suspended, color: 'bg-red-500',     pct: tenants?.total ? Math.round((tenants?.suspended / tenants?.total) * 100) : 0 },
              ].map(({ label, count, color, pct }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className={muted}>{label}</span>
                    <span className={`font-medium ${cardTxt}`}>{count || 0}</span>
                  </div>
                  <div className={`h-1.5 ${bar} rounded-full overflow-hidden`}>
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className={`border rounded-2xl p-5 transition-colors duration-300 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-violet-500" />
            <h2 className={`text-sm font-semibold ${cardTxt}`}>Recent Activity</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`h-10 ${pulse} rounded-lg animate-pulse`} />
              ))}
            </div>
          ) : recentActivity?.length ? (
            <div className="space-y-2">
              {recentActivity.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1.5">
                  <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-violet-500 shrink-0" />
                  <div className="min-w-0">
                    <p className={`text-xs truncate ${rowTxt}`}>{item.action || item.event_type || 'Activity'}</p>
                    <p className={`text-[10px] ${dimmed}`}>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-xs py-4 text-center ${dimmed}`}>No recent activity</p>
          )}
        </div>
      </div>

    </div>
  );
};

export default PlatformDashboard;
