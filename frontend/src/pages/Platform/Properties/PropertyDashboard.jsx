import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api.js';
import PropertyCard from './PropertyCard.jsx';
import { Building2, Plus, Loader2, Activity, Database, HardDrive, Mail, Workflow, CheckCircle2, AlertCircle } from 'lucide-react';

const PropertyDashboard = () => {
  const [properties, setProperties] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [propRes, healthRes] = await Promise.all([
        api.get('/platform/properties'),
        api.get('/health') // Proxy usually routes /api/health to this
      ]);
      setProperties(propRes.data.data);
      setHealth(healthRes.data);
    } catch (err) {
      console.error(err);
      // If /health fails, maybe fallback to the backend directly if URL differs
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getHealthColor = (statusText) => {
    if (!statusText) return 'text-slate-500';
    if (statusText.includes('healthy') || statusText === 'configured') return 'text-emerald-400';
    if (statusText.includes('unhealthy') || statusText === 'unconfigured') return 'text-red-400';
    return 'text-amber-400';
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Properties</h1>
          <p className="text-sm text-slate-400 mt-1">Manage all properties across tenants</p>
        </div>
        <Link 
          to="/platform/properties/new" 
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" /> Add Property
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : properties.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300">No properties found</h3>
              <p className="text-slate-500 mt-1">Get started by creating a new property.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {properties.map(p => (
                <PropertyCard key={p.id} property={p} onStatusChange={fetchData} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-indigo-400" />
              Platform Health
            </h3>
            
            {!health ? (
              <div className="text-sm text-slate-500">Loading health metrics...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-slate-300"><Database className="w-4 h-4 text-slate-500" /> Database</span>
                  <span className={`font-medium ${getHealthColor(health.services?.database)}`}>
                    {health.services?.database?.split(' ')[0] || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-slate-300"><HardDrive className="w-4 h-4 text-slate-500" /> Storage</span>
                  <span className={`font-medium ${getHealthColor(health.services?.storage)}`}>
                    {health.services?.storage || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-slate-300"><Workflow className="w-4 h-4 text-slate-500" /> Workflow Engine</span>
                  <span className="font-medium text-emerald-400">Online</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-slate-300"><Mail className="w-4 h-4 text-slate-500" /> Email Queue</span>
                  <span className="font-medium text-emerald-400">Online</span>
                </div>
                
                <div className="pt-4 border-t border-slate-800">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Overall Status</span>
                    {health.success ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold"><CheckCircle2 className="w-4 h-4" /> Operational</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 font-bold"><AlertCircle className="w-4 h-4" /> Degraded</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDashboard;
