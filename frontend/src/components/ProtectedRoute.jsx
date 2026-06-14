import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loader2 } from 'lucide-react';

/**
 * ProtectedRoute
 *
 * Wraps routes that require authentication.
 * - Shows a loader while auth state is being restored from localStorage (on refresh).
 * - Redirects to /login if user is not authenticated.
 * - Renders children if authenticated.
 *
 * Authorization is always enforced server-side via JWT middleware.
 * This component handles UX-level redirection only.
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // Wait for localStorage restoration before making redirect decision
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
