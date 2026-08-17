import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api.js';
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft, Save } from 'lucide-react';

const steps = [
  { id: 1, title: 'Basic Information' },
  { id: 2, title: 'Location' },
  { id: 3, title: 'Branding' },
  { id: 4, title: 'Tax & Currency' },
  { id: 5, title: 'Business Config' },
  { id: 6, title: 'Review & Finish' }
];

const PropertyWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [draftId, setDraftId] = useState(null);
  
  const [formData, setFormData] = useState({
    basic: { name: '' },
    location: { address: '' },
    branding: { logo: '', darkLogo: '', favicon: '', primaryColor: '#4f46e5', secondaryColor: '#1e293b', accentColor: '#38bdf8', invoiceBranding: '', emailBranding: '' },
    taxCurrency: { timezone: 'UTC', currency: 'USD', taxId: '', taxRate: '' },
    business: { operations: '24/7', checkInTime: '14:00', checkOutTime: '11:00' }
  });

  // Automatically load draft on mount
  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const { data } = await api.get('/tenant/properties/drafts');
        if (data.data && data.data.length > 0) {
          const latestDraft = data.data[0];
          setDraftId(latestDraft.id);
          if (latestDraft.draft_data) {
            setFormData(JSON.parse(latestDraft.draft_data));
          }
          if (latestDraft.step) {
            setCurrentStep(latestDraft.step);
          }
        }
      } catch (err) {
        console.error('Failed to load drafts', err);
      }
    };
    fetchDrafts();
  }, []);

  const handleAutosave = async (stepOverride = currentStep) => {
    try {
      if (draftId) {
        await api.put(`/tenant/properties/drafts/${draftId}`, { draftData: formData, step: stepOverride });
      } else {
        const { data } = await api.post('/tenant/properties/drafts', { draftData: formData, step: stepOverride });
        setDraftId(data.draftId);
      }
    } catch (err) {
      console.error('Autosave failed:', err);
    }
  };

  const handleNext = async () => {
    if (currentStep < 6) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      await handleAutosave(nextStep);
    }
  };

  const handlePrev = async () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      await handleAutosave(prevStep);
    }
  };

  const handleFinish = async () => {
    if (!draftId) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/tenant/properties/drafts/${draftId}/publish`);
      // Start Provisioning Job automatically
      await api.post(`/tenant/properties/${data.propertyId}/provision`);
      navigate(`/platform/properties/${data.propertyId}`);
    } catch (err) {
      console.error('Publish failed', err);
      alert(err.response?.data?.message || 'Failed to publish property');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (category, field, value) => {
    setFormData(prev => ({
      ...prev,
      [category]: { ...prev[category], [field]: value }
    }));
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Add New Property</h1>
        <p className="text-sm text-slate-400">Step {currentStep} of {steps.length}</p>
      </div>

      <div className="flex gap-4 mb-8 border-b border-slate-800 pb-4 overflow-x-auto">
        {steps.map(step => (
          <div key={step.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${currentStep === step.id ? 'bg-indigo-600 text-white' : currentStep > step.id ? 'text-indigo-400' : 'text-slate-500'}`}>
            {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs">{step.id}</div>}
            <span className="whitespace-nowrap font-medium text-sm">{step.title}</span>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 min-h-[400px]">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Basic Information</h2>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Property Name</label>
              <input type="text" value={formData.basic.name} onChange={e => updateField('basic', 'name', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" placeholder="e.g. The Grand Hotel" />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Location</h2>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Full Address</label>
              <textarea value={formData.location.address} onChange={e => updateField('location', 'address', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white h-24" placeholder="Enter complete address..." />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Branding</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm text-slate-400 mb-1">Logo URL</label><input type="text" value={formData.branding.logo} onChange={e => updateField('branding', 'logo', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Dark Logo URL</label><input type="text" value={formData.branding.darkLogo} onChange={e => updateField('branding', 'darkLogo', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Primary Color</label><input type="color" value={formData.branding.primaryColor} onChange={e => updateField('branding', 'primaryColor', e.target.value)} className="w-full h-10 bg-slate-950 border border-slate-800 rounded p-1" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Accent Color</label><input type="color" value={formData.branding.accentColor} onChange={e => updateField('branding', 'accentColor', e.target.value)} className="w-full h-10 bg-slate-950 border border-slate-800 rounded p-1" /></div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Tax & Currency</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm text-slate-400 mb-1">Currency Code</label><input type="text" value={formData.taxCurrency.currency} onChange={e => updateField('taxCurrency', 'currency', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" placeholder="USD, INR, EUR" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Timezone</label><input type="text" value={formData.taxCurrency.timezone} onChange={e => updateField('taxCurrency', 'timezone', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" placeholder="Asia/Kolkata" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Tax ID / VAT No</label><input type="text" value={formData.taxCurrency.taxId} onChange={e => updateField('taxCurrency', 'taxId', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Base Tax Rate (%)</label><input type="number" value={formData.taxCurrency.taxRate} onChange={e => updateField('taxCurrency', 'taxRate', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Business Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm text-slate-400 mb-1">Standard Check-In</label><input type="time" value={formData.business.checkInTime} onChange={e => updateField('business', 'checkInTime', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Standard Check-Out</label><input type="time" value={formData.business.checkOutTime} onChange={e => updateField('business', 'checkOutTime', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Review & Finish</h2>
            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-400">Name:</span> <span className="text-white ml-2">{formData.basic.name}</span></div>
                <div><span className="text-slate-400">Currency:</span> <span className="text-white ml-2">{formData.taxCurrency.currency}</span></div>
                <div><span className="text-slate-400">Timezone:</span> <span className="text-white ml-2">{formData.taxCurrency.timezone}</span></div>
                <div><span className="text-slate-400">Primary Color:</span> 
                  <span className="inline-block w-4 h-4 ml-2 align-middle rounded-full" style={{backgroundColor: formData.branding.primaryColor}}></span>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-4">By clicking Finish, a new immutable Property Code will be generated and the property will be set to Configured status.</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-6">
        <button onClick={handlePrev} disabled={currentStep === 1 || loading} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 disabled:opacity-50">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        
        <div className="flex gap-3">
          <button onClick={() => handleAutosave(currentStep)} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white">
            <Save className="w-4 h-4" /> Autosave Draft
          </button>
          
          {currentStep < 6 ? (
            <button onClick={handleNext} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finish & Create Property'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyWizard;
