import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldAlert, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api.js';

const Verification = () => {
  const { user, isAuthenticated, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [resendCountdown, setResendCountdown] = useState(0);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (resendCountdown > 0) {
      const t = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCountdown]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  // If already verified, go to dashboard
  if (user?.email_verified) return <Navigate to="/dashboard" replace />;

  const handleSendOtp = async () => {
    if (resendCountdown > 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/send-otp');
      setResendCountdown(60); // 60 seconds countdown
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;

    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/verify-otp', { code: fullCode });
      
      // Save consent if checked
      if (consent) {
        await api.post('/auth/consent', { consent: true, version: 'v1.0' });
      }

      setSuccess(true);
      if (updateUser) {
         updateUser({ ...user, email_verified: true, verification_method: 'email_otp' });
      }
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index, val) => {
    if (!/^[0-9]?$/.test(val)) return;
    const newCode = [...code];
    newCode[index] = val;
    setCode(newCode);

    // Auto-focus next
    if (val && index < 5) {
      document.getElementById(`code-\${index + 1}`).focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      document.getElementById(`code-\${index - 1}`).focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-indigo-500" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Verify your identity
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          For security reasons, we need to verify your email address before granting access.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-800">
          
          <div className="mb-6 text-center">
            <div className="text-sm text-slate-400">Verification code sent to</div>
            <div className="text-md font-medium text-slate-200">{user?.email}</div>
          </div>

          {error && (
            <div className="mb-4 bg-red-900/50 border border-red-500/50 rounded-md p-3 flex items-start gap-3 text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-900/50 border border-emerald-500/50 rounded-md p-3 flex items-start gap-3 text-emerald-200 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Verification successful! Redirecting...</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex justify-center gap-2">
              {code.map((digit, i) => (
                <input
                  key={i}
                  id={`code-\${i}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={loading || success}
                />
              ))}
            </div>

            <div className="flex items-center mt-4">
              <input
                id="marketing_consent"
                name="marketing_consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="h-4 w-4 text-indigo-500 focus:ring-indigo-500 border-slate-700 rounded bg-slate-950"
              />
              <label htmlFor="marketing_consent" className="ml-2 block text-sm text-slate-400">
                Receive product updates and marketing emails (Optional)
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || success || code.join('').length < 6}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Email'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900 text-slate-400">Didn't receive code?</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={handleSendOtp}
                disabled={loading || resendCountdown > 0 || success}
                className="w-full inline-flex justify-center py-2 px-4 border border-slate-700 rounded-md shadow-sm bg-slate-800 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCountdown > 0 ? `Resend in \${resendCountdown}s` : 'Resend OTP'}
              </button>
              <button
                onClick={logout}
                className="w-full inline-flex justify-center py-2 px-4 border border-slate-700 rounded-md shadow-sm bg-slate-800 text-sm font-medium text-slate-300 hover:bg-slate-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verification;
