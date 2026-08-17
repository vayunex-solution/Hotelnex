import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, Bed, TrendingUp, MoreVertical, ExternalLink } from 'lucide-react';
import api from '../../../services/api.js';

const PropertyCard = ({ property, onStatusChange }) => {
  const [loadingPms, setLoadingPms] = useState(false);

  const statusColors = {
    'Active': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Draft': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    'Configured': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Ready': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'Maintenance': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Suspended': 'bg-red-500/10 text-red-400 border-red-500/20',
    'Archived': 'bg-stone-500/10 text-stone-400 border-stone-500/20'
  };

  const handleOpenPms = async () => {
    setLoadingPms(true);
    try {
      const { data } = await api.post(`/platform/properties/${property.id}/pms-session`);
      // Simulating scoped session open by storing in memory and opening in new tab
      // In production, the new tab would consume this token securely.
      sessionStorage.setItem('scoped_pms_token', data.token);
      window.open(`/dashboard?property=${property.id}`, '_blank');
    } catch (err) {
      alert('Failed to generate scoped session');
    } finally {
      setLoadingPms(false);
    }
  };

  const updateStatus = async (statusName) => {
    try {
      await api.patch(`/platform/properties/${property.id}/status`, { statusName });
      if (onStatusChange) onStatusChange();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            {property.name}
          </h3>
          <p className="text-xs text-slate-500 font-mono mt-1">{property.property_code}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[property.status_name]}`}>
          {property.status_name}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 py-4 border-y border-slate-800/50 mb-4">
        <div className="text-center">
          <Bed className="w-4 h-4 text-slate-500 mx-auto mb-1" />
          <div className="text-sm font-bold text-slate-300">--</div>
          <div className="text-xs text-slate-500">Rooms</div>
        </div>
        <div className="text-center border-x border-slate-800/50">
          <Users className="w-4 h-4 text-slate-500 mx-auto mb-1" />
          <div className="text-sm font-bold text-slate-300">--</div>
          <div className="text-xs text-slate-500">Employees</div>
        </div>
        <div className="text-center">
          <TrendingUp className="w-4 h-4 text-slate-500 mx-auto mb-1" />
          <div className="text-sm font-bold text-slate-300">--</div>
          <div className="text-xs text-slate-500">Revenue</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={handleOpenPms}
          disabled={loadingPms || property.status_name === 'Archived'}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <ExternalLink className="w-4 h-4" /> Open PMS
        </button>
        
        <div className="relative group">
          <button className="p-2 border border-slate-700 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
          
          <div className="absolute right-0 bottom-full mb-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <Link to={`/platform/properties/${property.id}`} className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-t-lg">Manage Settings</Link>
            {property.status_name !== 'Suspended' && (
              <button onClick={() => updateStatus('Suspended')} className="w-full text-left px-4 py-2 text-sm text-amber-400 hover:bg-slate-700">Suspend Property</button>
            )}
            {property.status_name === 'Suspended' && (
              <button onClick={() => updateStatus('Active')} className="w-full text-left px-4 py-2 text-sm text-emerald-400 hover:bg-slate-700">Restore (Active)</button>
            )}
            {property.status_name !== 'Archived' && (
              <button onClick={() => updateStatus('Archived')} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 rounded-b-lg">Archive Property</button>
            )}
            {property.status_name === 'Archived' && (
              <button onClick={() => updateStatus('Configured')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-b-lg">Restore from Archive</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
