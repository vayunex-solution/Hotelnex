import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';
import {
  Hotel, Phone, MapPin, Save, CheckCircle2, AlertCircle,
  Loader2, Settings as SettingsIcon, Building2, RefreshCw
} from 'lucide-react';

const Settings = () => {
  const [name,        setName]        = useState('');
  const [phone,       setPhone]       = useState('');
  const [address,     setAddress]     = useState('');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [successMsg,  setSuccessMsg]  = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  // ── Fetch current settings ────────────────────────────────────────────────
  const fetchSettings = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/settings');
      const s   = res.data.settings || {};
      setName(s.name || '');
      setPhone(s.phone_number || '');
      setAddress(s.address || '');
    } catch (e) {
      setErrorMsg('Failed to load hotel settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSuccessMsg(''); setErrorMsg('');
    if (!name.trim()) { setErrorMsg('Hotel name is required.'); return; }
    setSaving(true);
    try {
      const res = await api.put('/settings', { name: name.trim(), phone_number: phone.trim(), address: address.trim() });
      setSuccessMsg(res.data.message || 'Settings saved successfully!');
      // Notify MainLayout to refresh hotel name
      window.dispatchEvent(new CustomEvent('hotel-settings-updated', { detail: res.data.settings }));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      setErrorMsg(e?.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-sm">Loading hotel settings…</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <SettingsIcon className="w-5 h-5 text-indigo-400" />
            </span>
            Hotel Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1 ml-0.5">Hotel profile visible on invoices, receipts & letterheads</p>
        </div>
        <button
          type="button"
          onClick={fetchSettings}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-all self-start sm:self-auto shrink-0"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── SUCCESS / ERROR ───────────────────────────────────────────────── */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />{successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />{errorMsg}
        </div>
      )}

      {/* ── FORM ─────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-200">Hotel Profile</h2>
        </div>

        <div className="p-6 space-y-5">
          {/* Hotel Name */}
          <div className="space-y-1.5">
            <label htmlFor="settings-name" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Hotel Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Hotel className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Grand Vayunex Hotel"
                required
                className="w-full bg-slate-800/80 border border-slate-700/80 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all placeholder-slate-500"
              />
            </div>
            <p className="text-[10px] text-slate-600">Appears on invoices, registration slips & the sidebar header.</p>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label htmlFor="settings-phone" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Contact Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                id="settings-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full bg-slate-800/80 border border-slate-700/80 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all placeholder-slate-500"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label htmlFor="settings-address" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Hotel Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
              <textarea
                id="settings-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12, MG Road, Bengaluru, Karnataka 560001"
                rows={3}
                className="w-full bg-slate-800/80 border border-slate-700/80 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all placeholder-slate-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-600">Changes take effect immediately on all invoices & headers.</p>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* ── PREVIEW CARD ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Invoice Letterhead Preview</p>
        <div className="flex items-center gap-4 py-3 border-b border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Hotel className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <p className="font-black text-white text-lg">{name || 'Hotel Name'}</p>
            {address && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{address}</p>}
            {phone && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{phone}</p>}
          </div>
        </div>
        <p className="text-[9px] text-slate-700 text-center">by HotelNex powered by vayunex solution</p>
      </div>
    </div>
  );
};

export default Settings;
