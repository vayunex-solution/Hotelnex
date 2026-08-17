import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, RotateCcw, AlertTriangle, FileText, ChevronDown, ChevronRight, PauseCircle } from 'lucide-react';
import api from '../../../services/api.js';

const ProvisioningTimeline = ({ propertyId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await api.get(`/tenant/properties/${propertyId}/provision/status`);
      setData(res.data.data);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('Failed to fetch provision status', err);
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (data?.job?.status === 'Running' || data?.job?.status === 'Retrying') {
        fetchStatus();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [propertyId, data?.job?.status]);

  if (loading) return <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;
  if (!data || !data.job) return <div className="text-slate-500 text-sm">No active provisioning jobs.</div>;

  const { job, steps, logs } = data;

  const handleAction = async (action) => {
    try {
      await api.post(`/tenant/properties/${propertyId}/provision/${action}`);
      fetchStatus();
    } catch (err) {
      alert(`Failed to ${action}: ${err.response?.data?.message || err.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Success': return 'text-emerald-500';
      case 'Failed': return 'text-red-500';
      case 'Running': return 'text-indigo-400';
      case 'Skipped': return 'text-slate-500';
      default: return 'text-slate-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Success': return <CheckCircle2 className="w-5 h-5" />;
      case 'Failed': return <XCircle className="w-5 h-5" />;
      case 'Running': return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'Skipped': return <RotateCcw className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Provisioning Engine
            <span className={`px-2 py-0.5 rounded text-xs border ${
              job.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              job.status === 'Failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              job.status === 'Cancelled' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            }`}>
              {job.status}
            </span>
          </h3>
          <p className="text-sm text-slate-400 mt-1">Overall Progress: {job.progress_percent}%</p>
        </div>

        <div className="flex gap-2">
          {job.status === 'Failed' && (
            <button onClick={() => handleAction('retry')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
              <RotateCcw className="w-4 h-4" /> Retry Failed Step
            </button>
          )}
          {['Failed', 'Cancelled'].includes(job.status) && (
            <button onClick={() => handleAction('resume')} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded hover:bg-slate-700 border border-slate-700">
              <RotateCcw className="w-4 h-4" /> Resume Provision
            </button>
          )}
          {['Running', 'Pending', 'Retrying'].includes(job.status) && (
            <button onClick={() => handleAction('cancel')} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 text-sm rounded hover:bg-red-500/20 border border-red-500/20">
              <PauseCircle className="w-4 h-4" /> Cancel Provision
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step) => {
          const isExpanded = expandedStep === step.id;
          const stepLogs = logs.filter(l => l.step_id === step.id);

          return (
            <div key={step.id} className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={getStatusColor(step.status)}>
                    {getStatusIcon(step.status)}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-200">
                      Step {step.step_order}: {step.description}
                    </h4>
                    {step.status === 'Failed' && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {step.error_message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{step.execution_time_ms}ms</span>
                  {step.retry_count > 0 && <span className="text-amber-500 border border-amber-500/20 bg-amber-500/10 px-1.5 rounded">Retry: {step.retry_count}</span>}
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-300 font-mono">
                  <div className="mb-4">
                    <h5 className="font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><FileText className="w-3 h-3" /> Step Output</h5>
                    <pre className="bg-slate-950 p-2 rounded overflow-x-auto text-emerald-400/80">
                      {step.output_json ? JSON.stringify(step.output_json, null, 2) : 'No output.'}
                    </pre>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-500 uppercase tracking-wider mb-2">Execution Logs</h5>
                    <div className="space-y-1">
                      {stepLogs.length === 0 ? <span className="text-slate-600">No logs for this step.</span> : stepLogs.map(l => (
                        <div key={l.id} className="flex gap-2">
                          <span className="text-slate-500">[{new Date(l.created_at).toLocaleTimeString()}]</span>
                          <span className={l.log_level === 'ERROR' ? 'text-red-400' : 'text-slate-300'}>[{l.log_level}] {l.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProvisioningTimeline;
