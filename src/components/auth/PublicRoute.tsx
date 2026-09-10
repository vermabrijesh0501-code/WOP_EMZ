import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Warehouse } from 'lucide-react';

interface PublicRouteProps {
  children?: React.ReactNode;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { appUser, session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-primary text-primary flex flex-col items-center justify-center p-6 theme-transition">
        <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center animate-pulse">
          <Warehouse className="w-6 h-6 text-blue-400" />
        </div>
      </div>
    );
  }

  const isAuthenticated = !!session || !!appUser;
  if (isAuthenticated) {
    // Redirect to the originally requested URL or default to /dashboard
    const origin = (location.state as any)?.from?.pathname || '/dashboard';
    return <Navigate to={origin} replace />;
  }

  return <>{children}</>;
};
