import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Shield, Warehouse, Sparkles } from 'lucide-react';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { appUser, session, loading, isConfigured } = useAuth();
  const location = useLocation();

  // 1. Loading State: Display high-performance warehouse loading view
  if (loading) {
    return (
      <div className="min-h-screen bg-primary text-primary flex flex-col items-center justify-center p-6 select-none theme-transition">
        <div className="relative flex flex-col items-center max-w-sm text-center">
          {/* Glowing Animated App Icon */}
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-2xl shadow-blue-500/30 animate-pulse">
              <div className="w-full h-full bg-surface rounded-[14px] flex items-center justify-center">
                <Warehouse className="w-8 h-8 text-blue-400 animate-bounce" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          <h2 className="text-lg font-black tracking-tight text-primary flex items-center gap-2">
            EMIZA-WOP <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Auth Guard</span>
          </h2>
          <p className="text-xs text-secondary mt-2">
            Verifying Supabase security session & warehouse access credentials...
          </p>

          <div className="mt-6 w-48 h-1.5 bg-elevated rounded-full overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-[pulse_1s_ease-in-out_infinite]" />
          </div>

          <div className="mt-4 text-[11px] text-muted flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>{isConfigured ? 'Connected to Supabase Project' : 'Local Workspace Mode'}</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Redirect to /login and preserve destination in location.state
  const isAuthenticated = !!session || !!appUser;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Deactivated / Inactive Account Block
  if (appUser && (appUser.status === 'Inactive' || (appUser as any).is_active === false)) {
    return (
      <Navigate
        to="/login"
        state={{
          error: 'Your account has been deactivated by an Administrator. Please contact Verma.brijesh0501@gmail.com for access.',
        }}
        replace
      />
    );
  }

  // 4. Authenticated & Active: Render protected child routes
  return <>{children}</>;
};
