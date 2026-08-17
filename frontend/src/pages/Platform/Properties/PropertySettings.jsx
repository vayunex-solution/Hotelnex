import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../services/api.js';
import { Settings, Image, Briefcase, Calculator, Globe, Bell, Shield, Save, Loader2, PlaySquare } from 'lucide-react';
import ProvisioningTimeline from './ProvisioningTimeline.jsx';

const tabs = [
  { id: 'provisioning', label: 'Provisioning Status', icon: PlaySquare },
  { id: 'general', label: 'General', icon: Settings },
  { id: 'branding', label: 'Branding', icon: Image },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'taxes', label: 'Taxes', icon: Calculator },
  { id: 'currency', label: 'Currency & Timezone', icon: Globe },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield }
];

const PropertySettings = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('provisioning');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [property, setProperty] = useState(null);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const { data } = await api.get(`/platform/properties/${id}`);
        setProperty(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    // Stub save implementation. In a real scenario, we PUT settings to the backend
    setTimeout(() => setSaving(false), 1000);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>;
  if (!property) return <div className="p-8 text-white">Property not found.</div>;

  return (
    <div className="max-w-6xl mx-auto py-8 flex gap-8">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <h2 className="text-xl font-bold text-white mb-6 px-4">{property.name}</h2>
        <nav className="space-y-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-8">
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <h3 className="text-xl font-bold text-white">{tabs.find(t => t.id === activeTab)?.label}</h3>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        {activeTab === 'general' && (
          <div className="space-y-4 max-w-lg">
            <div><label className="block text-sm text-slate-400 mb-1">Property Name</label><input type="text" defaultValue={property.name} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
            <div><label className="block text-sm text-slate-400 mb-1">Property Code</label><input type="text" disabled defaultValue={property.property_code} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-500 cursor-not-allowed" /></div>
            <div><label className="block text-sm text-slate-400 mb-1">Address</label><textarea defaultValue={property.address} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white h-24" /></div>
          </div>
        )}

        {activeTab === 'provisioning' && (
          <ProvisioningTimeline propertyId={id} />
        )}

        {/* Other tabs would render settings based on property.settings mapped out */}
        {activeTab !== 'general' && activeTab !== 'provisioning' && (
          <div className="text-slate-400 text-sm flex items-center justify-center h-48 border border-dashed border-slate-700 rounded-lg">
            Configuration fields for {tabs.find(t => t.id === activeTab)?.label} will appear here.
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertySettings;
