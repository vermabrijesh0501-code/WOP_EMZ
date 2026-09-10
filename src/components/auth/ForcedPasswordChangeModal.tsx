import React, { useState } from 'react';
import {
  ShieldAlert,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { User } from '../../types';

interface ForcedPasswordChangeModalProps {
  user: User;
  onPasswordChanged: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  onSignOut: () => Promise<void>;
}

export const ForcedPasswordChangeModal: React.FC<ForcedPasswordChangeModalProps> = ({
  user,
  onPasswordChanged,
  onSignOut,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validation rules
  const hasMinLength = newPassword.length >= 6;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isValid = hasMinLength && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasMinLength) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (!passwordsMatch) {
      setError('New passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onPasswordChanged(newPassword);
      if (res.success) {
        setIsSuccess(true);
      } else {
        setError(res.error || 'Failed to update password. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while updating your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="forced-password-change-modal"
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg animate-in fade-in select-none"
    >
      <div className="bg-[#131E32] border border-slate-700/90 rounded-3xl p-6 sm:p-9 max-w-lg w-full shadow-2xl space-y-6 text-slate-100 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-52 h-52 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start gap-3.5 border-b border-slate-800 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              <span>Mandatory First-Time Security Requirement</span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Change Temporary Password
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Account: <span className="text-purple-300 font-mono font-semibold">{user.email}</span>
            </p>
          </div>
        </div>

        {/* Informative Security Context */}
        <div className="p-3.5 rounded-2xl bg-[#0B1120] border border-slate-800 text-xs text-slate-300 leading-relaxed">
          <p>
            Your account was registered or reset with a temporary password. Under WOP enterprise security guidelines, you must establish a permanent personal password before accessing warehouse modules.
          </p>
        </div>

        {/* Success Alert */}
        {isSuccess ? (
          <div className="p-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Password Updated Successfully!</h4>
            <p className="text-xs text-emerald-200/90">
              Your permanent password has been established. You are now authorized to access the terminal.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                New Personal Password *
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-[#0F172A] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-3 pr-10 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Confirm New Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-[#0F172A] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-3 pr-10 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Validation Checklist */}
            <div className="p-3 rounded-xl bg-[#0B1120] border border-slate-800/80 space-y-1.5 text-[11px]">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>At least 6 characters long</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Includes uppercase letter (recommended)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Passwords match</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => onSignOut()}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>

              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-900/40"
              >
                {isSubmitting ? (
                  <span>Updating Password...</span>
                ) : (
                  <>
                    <span>Save & Enter Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
