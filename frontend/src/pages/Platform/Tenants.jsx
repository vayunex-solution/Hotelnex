import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import platformApi from '../../services/platformApi.js';
import { usePlatformTheme } from '../../context/PlatformThemeContext.jsx';
import {
  Building2, Search, Plus, RefreshCw, AlertCircle,
  MoreHorizontal, CheckCircle2, Ban, ChevronLeft,
  ChevronRight, X, Loader2, Globe, Trash2, Edit2
} from 'lucide-react';

// ─── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const styles = {
    active:    'bg-emerald-500/15 text-emerald-500 border-emerald-500/25',
    trial:     'bg-amber-500/15 text-amber-500 border-amber-500/25',
    suspended: 'bg-red-500/15 text-red-500 border-red-500/25',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[status] || styles.trial}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

// ─── Provision Modal ───────────────────────────────────────────────────────────
const ProvisionModal = ({ onClose, onSuccess, isDark }) => {
  const [form, setForm]       = useState({ name: '', contactEmail: '', country: 'IN', timezone: 'Asia/Kolkata', currencyCode: 'INR' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState(null);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.contactEmail) { setError('Name and email are required.'); return; }
    try {
      setLoading(true);
      const res = await platformApi.post('/tenants', form);
      setResult(res.data.data);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Provisioning failed.');
    } finally {
      setLoading(false);
    }
  };

  const modalBg   = isDark ? 'bg-[#0e0e1a] border-violet-900/30' : 'bg-white border-slate-200 shadow-2xl';
  const headerBdr = isDark ? 'border-slate-800/60' : 'border-slate-100';
  const labelCls  = isDark ? 'text-slate-400'       : 'text-slate-500';
  const inputCls  = isDark
    ? 'bg-slate-900/60 border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-violet-500/60 focus:ring-violet-500/10'
    : 'bg-slate-50 border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:ring-violet-400/10';
  const closeBtnCls = isDark ? 'bg-slate-800/60 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800';
  const cancelCls   = isDark ? 'border-slate-700/50 text-slate-400 hover:bg-slate-800/40' : 'border-slate-300 text-slate-500 hover:bg-slate-50';
  const resultBg    = isDark ? 'bg-slate-900/60 border-slate-800/60 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700';
  const resultLabel = isDark ? 'text-slate-500' : 'text-slate-400';
  const titleCls    = isDark ? 'text-white' : 'text-slate-800';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`border rounded-2xl w-full max-w-lg ${modalBg}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${headerBdr}`}>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-violet-500" />
            <h2 className={`text-sm font-semibold ${titleCls}`}>Provision New Tenant</h2>
          </div>
          <button onClick={onClose} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${closeBtnCls}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {result ? (
            /* Success State */
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Tenant provisioned successfully!
              </div>
              <div className={`border rounded-xl p-4 space-y-2 text-xs ${resultBg}`}>
                <div className="flex justify-between"><span className={resultLabel}>Tenant ID</span><span className="font-mono">{result.tenant?.id}</span></div>
                <div className="flex justify-between"><span className={resultLabel}>Slug</span><span className="font-mono">{result.tenant?.slug}</span></div>
                <div className="flex justify-between"><span className={resultLabel}>Property ID</span><span className="font-mono">{result.property?.id}</span></div>
                <div className="flex justify-between"><span className={resultLabel}>Admin Email</span><span>{result.admin?.email}</span></div>
                <div className="flex justify-between">
                  <span className={resultLabel}>Temp Password</span>
                  <span className="text-amber-500 font-mono font-bold">{result.admin?.temporaryPassword}</span>
                </div>
              </div>
              <p className="text-xs text-amber-500/80">⚠ Share the temporary password securely and advise the tenant to change it immediately.</p>
              <button onClick={onClose} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
                Close
              </button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {[
                { label: 'Company Name *', key: 'name',         type: 'text',  placeholder: 'Grand Hyatt Hotels' },
                { label: 'Admin Email *',  key: 'contactEmail', type: 'email', placeholder: 'admin@grandhyatt.com' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={e => update(key, e.target.value)}
                    placeholder={placeholder}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${inputCls}`}
                  />
                </div>
              ))}

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Country',  key: 'country',      placeholder: 'IN'           },
                  { label: 'Timezone', key: 'timezone',     placeholder: 'Asia/Kolkata' },
                  { label: 'Currency', key: 'currencyCode', placeholder: 'INR'          },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>{label}</label>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={e => update(key, e.target.value)}
                      placeholder={placeholder}
                      className={`w-full px-3 py-2.5 border rounded-xl text-xs focus:outline-none transition-all ${inputCls}`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex-1 py-2.5 border text-sm rounded-xl transition-colors ${cancelCls}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-violet-500/20"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning...</> : 'Provision Tenant'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Tenants Page ─────────────────────────────────────────────────────────
const Tenants = () => {
  const navigate  = useNavigate();
  const { isDark } = usePlatformTheme();
  const [tenants, setTenants]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState('');
  const [search,  setSearch]    = useState('');
  const [page,    setPage]      = useState(1);
  const [pagination, setPagination] = useState({});
  const [showModal,  setShowModal]  = useState(false);
  const [actionMenu, setActionMenu] = useState(null);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await platformApi.get('/tenants', { params: { page, limit: 15, search } });
      setTenants(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tenants.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const changeStatus = async (id, status) => {
    try {
      await platformApi.patch(`/tenants/${id}/status`, { status });
      fetchTenants();
    } catch (err) {
      alert(err.response?.data?.message || 'Status update failed.');
    }
    setActionMenu(null);
  };

  const softDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this tenant? This action is reversible.')) return;
    try {
      await platformApi.delete(`/tenants/${id}`);
      fetchTenants();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    }
    setActionMenu(null);
  };

  // ── Theme tokens ─────────────────────────────────────────────────────────────
  const titleCls   = isDark ? 'text-white'    : 'text-slate-800';
  const muted      = isDark ? 'text-slate-500' : 'text-slate-400';
  const tableBg    = isDark ? 'bg-[#0e0e1a] border-slate-800/60'  : 'bg-white border-slate-200 shadow-sm';
  const thCls      = isDark ? 'text-slate-500 border-slate-800/60' : 'text-slate-400 border-slate-100';
  const trHover    = isDark ? 'hover:bg-slate-800/20' : 'hover:bg-violet-50/50';
  const divider    = isDark ? 'divide-slate-800/40' : 'divide-slate-100';
  const tdTxt      = isDark ? 'text-slate-200' : 'text-slate-700';
  const tdMono     = isDark ? 'text-slate-500' : 'text-slate-400';
  const tdSmall    = isDark ? 'text-slate-500' : 'text-slate-400';
  const emptyTxt   = isDark ? 'text-slate-500' : 'text-slate-400';
  const menuBg     = isDark ? 'bg-[#151520] border-slate-700/50' : 'bg-white border-slate-200 shadow-xl';
  const searchCls  = isDark
    ? 'bg-slate-900/60 border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-violet-500/60 focus:ring-violet-500/10'
    : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:ring-violet-400/10';
  const refreshBtn = isDark
    ? 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-white'
    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50';
  const pgBtn      = isDark
    ? 'border-slate-700/50 text-slate-400 hover:text-white hover:border-violet-500/50'
    : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:border-violet-400';
  const pgBar      = isDark ? 'border-slate-800/60' : 'border-slate-100';
  const avatarBg   = isDark ? 'bg-violet-500/15 border-violet-500/20 text-violet-400' : 'bg-violet-50 border-violet-200 text-violet-600';

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${titleCls}`}>Tenants</h1>
          <p className={`text-sm mt-0.5 ${muted}`}>
            {pagination.total !== undefined ? `${pagination.total} total tenant${pagination.total !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="provision-tenant-btn"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-violet-500/20"
          >
            <Plus className="w-4 h-4" />
            New Tenant
          </button>
          <button
            onClick={fetchTenants}
            disabled={loading}
            className={`w-9 h-9 flex items-center justify-center border rounded-xl transition-colors disabled:opacity-50 ${refreshBtn}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${muted}`} />
        <input
          id="tenant-search"
          type="text"
          placeholder="Search by name or slug..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className={`w-full sm:w-80 pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${searchCls}`}
        />
        {search && (
          <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${muted} hover:text-slate-300`}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${tableBg}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${thCls}`}>
                <th className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider ${thCls}`}>Tenant</th>
                <th className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider hidden md:table-cell ${thCls}`}>Slug</th>
                <th className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider ${thCls}`}>Status</th>
                <th className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell ${thCls}`}>Region</th>
                <th className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell ${thCls}`}>Created</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className={`divide-y ${divider}`}>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className={`h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg animate-pulse`} style={{ width: `${60 + Math.random() * 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`px-5 py-12 text-center text-sm ${emptyTxt}`}>
                    {search ? 'No tenants match your search.' : 'No tenants yet. Provision your first one!'}
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className={`transition-colors duration-150 cursor-pointer ${trHover}`}
                    onClick={() => navigate(`/platform/tenants/${tenant.id}`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${avatarBg}`}>
                          {tenant.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className={`font-medium ${tdTxt}`}>{tenant.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className={`font-mono text-xs ${tdMono}`}>{tenant.slug}</span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={tenant.status} />
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className={`flex items-center gap-1.5 text-xs ${tdSmall}`}>
                        <Globe className="w-3.5 h-3.5" />
                        {tenant.country || '—'} · {tenant.currency_code || '—'}
                      </div>
                    </td>
                    <td className={`px-5 py-4 hidden lg:table-cell text-xs ${tdSmall}`}>
                      {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() => setActionMenu(actionMenu === tenant.id ? null : tenant.id)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${muted} ${isDark ? 'hover:text-slate-200 hover:bg-slate-700/50' : 'hover:text-slate-700 hover:bg-slate-100'}`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {actionMenu === tenant.id && (
                          <div className={`absolute right-0 top-full mt-1 w-44 border rounded-xl z-20 py-1 overflow-hidden ${menuBg}`}>
                            {tenant.status !== 'active' && (
                              <button onClick={() => changeStatus(tenant.id, 'active')} className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-500 transition-colors ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-emerald-50'}`}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Activate
                              </button>
                            )}
                            {tenant.status !== 'suspended' && (
                              <button onClick={() => changeStatus(tenant.id, 'suspended')} className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-500 transition-colors ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-amber-50'}`}>
                                <Ban className="w-3.5 h-3.5" /> Suspend
                              </button>
                            )}
                            <div className={`border-t my-1 ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`} />
                            <button onClick={() => navigate(`/platform/tenants/${tenant.id}`)} className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${muted} ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}>
                              <Edit2 className="w-3.5 h-3.5" /> View Details
                            </button>
                            <button onClick={() => softDelete(tenant.id)} className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 transition-colors ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-red-50'}`}>
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className={`flex items-center justify-between px-5 py-3 border-t ${pgBar}`}>
            <p className={`text-xs ${muted}`}>
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${pgBtn}`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${pgBtn}`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Provision Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <ProvisionModal
          isDark={isDark}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchTenants(); }}
        />
      )}
    </div>
  );
};

export default Tenants;
