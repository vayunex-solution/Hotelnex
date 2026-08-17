import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import platformApi from '../../services/platformApi.js';
import { usePlatformTheme } from '../../context/PlatformThemeContext.jsx';
import {
  ArrowLeft, Building2, Globe, Calendar, Activity,
  Edit2, AlertCircle, CheckCircle2, Ban, Loader2, Save, X
} from 'lucide-react';

const StatusBadge = ({ status }) => {
  const styles = {
    active:    'bg-emerald-500/15 text-emerald-500 border-emerald-500/25',
    trial:     'bg-amber-500/15 text-amber-500 border-amber-500/25',
    suspended: 'bg-red-500/15 text-red-500 border-red-500/25',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status] || styles.trial}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

const TenantDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = usePlatformTheme();

  const [tenant,  setTenant]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({});

  const fetchTenant = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await platformApi.get(`/tenants/${id}`);
      setTenant(res.data.data);
      setForm({
        timezone: res.data.data.timezone,
        currencyCode: res.data.data.currency_code,
        country: res.data.data.country
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tenant.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, [id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await platformApi.put(`/tenants/${id}`, form);
      await fetchTenant();
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!confirm(`Change status to ${newStatus}?`)) return;
    try {
      await platformApi.patch(`/tenants/${id}/status`, { status: newStatus });
      fetchTenant();
    } catch (err) {
      alert(err.response?.data?.message || 'Status update failed.');
    }
  };

  // ── Theme tokens ─────────────────────────────────────────────────────────────
  const card       = isDark ? 'bg-[#0e0e1a] border-slate-800/60' : 'bg-white border-slate-200 shadow-sm';
  const textCls    = isDark ? 'text-slate-100' : 'text-slate-800';
  const textMuted  = isDark ? 'text-slate-500' : 'text-slate-400';
  const row        = isDark ? 'bg-slate-900/40 hover:bg-slate-900/60' : 'bg-slate-50 hover:bg-slate-100';
  const rowTxt     = isDark ? 'text-slate-200' : 'text-slate-700';
  const rowSub     = isDark ? 'text-slate-500' : 'text-slate-400';
  const borderCls  = isDark ? 'border-slate-800/60' : 'border-slate-100';
  const inputCls   = isDark
    ? 'bg-slate-900/60 border-violet-500/30 text-slate-200 focus:ring-violet-500/30'
    : 'bg-white border-slate-300 text-slate-800 focus:ring-violet-400/10';
  const backBtn    = isDark
    ? 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700/60'
    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50';
  const headerTxt  = isDark ? 'text-white' : 'text-slate-800';
  const editBtn    = isDark
    ? 'text-violet-400 border-violet-500/20 hover:bg-violet-500/10'
    : 'text-violet-600 border-violet-200 hover:bg-violet-50';
  const spinnerClr = isDark ? 'text-violet-400' : 'text-violet-600';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className={`w-6 h-6 animate-spin ${spinnerClr}`} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/platform/tenants')}
          className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${backBtn}`}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className={`text-2xl font-bold tracking-tight truncate ${headerTxt}`}>{tenant?.name}</h1>
            {tenant?.status && <StatusBadge status={tenant.status} />}
          </div>
          <p className={`text-xs font-mono mt-0.5 ${textMuted}`}>{tenant?.slug}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tenant?.status !== 'active' && (
            <button
              onClick={() => handleStatusChange('active')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/10 rounded-xl transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Activate
            </button>
          )}
          {tenant?.status !== 'suspended' && (
            <button
              onClick={() => handleStatusChange('suspended')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-500 border border-amber-500/20 hover:bg-amber-500/10 rounded-xl transition-colors"
            >
              <Ban className="w-3.5 h-3.5" /> Suspend
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-xl transition-colors ${editBtn}`}
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Configuration Card */}
        <div className={`border rounded-2xl p-5 space-y-4 transition-colors duration-300 ${card}`}>
          <div className={`flex items-center gap-2 border-b pb-3 ${borderCls}`}>
            <Globe className="w-4 h-4 text-violet-500" />
            <h2 className={`text-sm font-semibold ${textCls}`}>Configuration</h2>
            {editing && (
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setEditing(false)} className={`text-xs ${textMuted} hover:text-slate-300 transition-colors`}>
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 transition-colors font-medium"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            )}
          </div>
          {[
            { label: 'Timezone', key: 'timezone' },
            { label: 'Currency', key: 'currencyCode' },
            { label: 'Country',  key: 'country'  },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center justify-between">
              <span className={`text-xs ${textMuted}`}>{label}</span>
              {editing ? (
                <input
                  type="text"
                  value={form[key] || ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className={`w-36 px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 ${inputCls}`}
                />
              ) : (
                <span className={`text-xs font-mono ${textCls}`}>
                  {key === 'currencyCode' ? tenant?.currency_code : tenant?.[key] || '—'}
                </span>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <span className={`text-xs ${textMuted}`}>Created</span>
            <span className={`text-xs ${textMuted}`}>
              {tenant?.created_at ? new Date(tenant.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>

        {/* Properties Card */}
        <div className={`border rounded-2xl p-5 col-span-2 transition-colors duration-300 ${card}`}>
          <div className={`flex items-center gap-2 border-b pb-3 mb-4 ${borderCls}`}>
            <Building2 className="w-4 h-4 text-violet-500" />
            <h2 className={`text-sm font-semibold ${textCls}`}>Properties</h2>
            <span className={`text-xs ml-auto ${textMuted}`}>{tenant?.properties?.length || 0} total</span>
          </div>
          {tenant?.properties?.length ? (
            <div className="space-y-2">
              {tenant.properties.map(p => (
                <div key={p.id} className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${row}`}>
                  <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center text-violet-500 shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${rowTxt}`}>{p.name}</p>
                    <p className={`text-[10px] ${rowSub}`}>{p.phone_number || p.address || '—'}</p>
                  </div>
                  <span className={`text-[10px] ml-auto shrink-0 font-mono ${textMuted}`}>#{p.id}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-xs py-6 text-center ${textMuted}`}>No properties associated yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantDetails;
