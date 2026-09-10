import React, { useState } from 'react';
import {
  RotateCcw,
  KeyRound,
  Mail,
  Sparkles,
  Eye,
  EyeOff,
  Send,
  AlertCircle,
} from 'lucide-react';
import { generateSecureTempPassword } from '../../utils/credentialUtils';

interface AdminResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    empId?: string;
    name: string;
    email: string;
    role: string;
    status: string;
    department?: string;
  } | null;
  onConfirmReset: (params: {
    userId: string;
    email: string;
    tempPassword: string;
    mustChangePassword: boolean;
    sendEmailLink?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const AdminResetPasswordModal: React.FC<AdminResetPasswordModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onConfirmReset,
}) => {
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [sendEmailLink, setSendEmailLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !targetUser) return null;

  const handleGeneratePassword = () => {
    const generated = generateSecureTempPassword();
    setTempPassword(generated);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tempPassword.trim() || tempPassword.length < 6) {
      setError('Temporary password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onConfirmReset({
        userId: targetUser.id,
        email: targetUser.email,
        tempPassword: tempPassword.trim(),
        mustChangePassword,
        sendEmailLink,
      });

      if (!res.success) {
        setError(res.error || 'Failed to reset password.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="admin-reset-password-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in select-none"
    >
      <div className="bg-[#131E32] border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Reset User Credentials</h3>
              <p className="text-xs text-slate-400">Issue new temporary password for user</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* User Summary Card */}
        <div className="p-3.5 rounded-2xl bg-[#0B1120] border border-slate-800 text-xs flex items-center justify-between">
          <div>
            <div className="font-bold text-white text-sm">{targetUser.name}</div>
            <div className="font-mono text-slate-400 text-[11px] mt-0.5">{targetUser.email}</div>
          </div>
          <div className="text-right">
            <span className="font-mono text-purple-300 font-bold text-xs block">
              {targetUser.empId || targetUser.id}
            </span>
            <span className="text-[11px] text-slate-400">{targetUser.role}</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Temporary Password Field + Auto Generate */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                <span>New Temporary Password *</span>
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Generate</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Enter or generate temporary password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-white font-mono text-sm focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum 6 characters. This password will be displayed once after submission.
            </p>
          </div>

          {/* Forced Password Change Flag (Locked to TRUE for security) */}
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={mustChangePassword}
                onChange={(e) => setMustChangePassword(e.target.checked)}
                className="w-4 h-4 rounded mt-0.5 text-purple-600 focus:ring-0 cursor-pointer"
              />
              <div>
                <span className="font-bold text-purple-200">Force user to change password on next sign-in</span>
                <p className="text-[11px] text-purple-300/80 leading-relaxed mt-0.5">
                  The user will be immediately redirected to a mandatory password change screen upon login.
                </p>
              </div>
            </label>
          </div>

          {/* Optional Send Email Link Checkbox */}
          <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmailLink}
                onChange={(e) => setSendEmailLink(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Also dispatch Supabase official password reset link to user email</span>
              </div>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-amber-900/30"
            >
              {isSubmitting ? (
                <span>Resetting...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Issue Temporary Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
