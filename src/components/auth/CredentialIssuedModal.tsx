import React, { useState } from 'react';
import {
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { copyToClipboard, formatCredentialSummary, CredentialSummaryParams } from '../../utils/credentialUtils';

interface CredentialIssuedModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: {
    userId: string;
    empId?: string;
    name: string;
    email: string;
    role: string;
    department?: string;
    status: string;
    tempPassword?: string;
    actionType?: 'create' | 'reset';
  } | null;
}

export const CredentialIssuedModal: React.FC<CredentialIssuedModalProps> = ({
  isOpen,
  onClose,
  credentials,
}) => {
  const [showPassword, setShowPassword] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen || !credentials) return null;

  const handleCopy = async (field: string, value: string) => {
    const success = await copyToClipboard(value);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleCopyAll = async () => {
    const summaryParams: CredentialSummaryParams = {
      userId: credentials.empId || credentials.userId,
      name: credentials.name,
      email: credentials.email,
      role: credentials.role,
      department: credentials.department,
      status: credentials.status,
      tempPassword: credentials.tempPassword,
    };
    const summaryText = formatCredentialSummary(summaryParams);
    const success = await copyToClipboard(summaryText);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  const isReset = credentials.actionType === 'reset';

  return (
    <div
      id="credential-issued-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in select-none"
    >
      <div className="bg-[#131E32] border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 text-slate-100 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-md">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3" />
                <span>{isReset ? 'Password Reset Complete' : 'User Account Provisioned'}</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">
                {isReset ? 'New Temporary Credentials Issued' : 'User Credentials & Access Issued'}
              </h3>
            </div>
          </div>
          <button
            id="close-credential-modal-x"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl p-1 transition-colors cursor-pointer"
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* High Priority One-Time Security Alert */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-amber-200">One-Time Display Security Notice:</span>
            <p className="mt-1 text-amber-300/90">
              This temporary password is displayed <strong>ONLY ONCE</strong> for strict security compliance.
              It is never stored in plain text and cannot be retrieved again. Please copy or securely share it with the user now.
              The user will be required to change this temporary password upon their first sign-in.
            </p>
          </div>
        </div>

        {/* Structured Credential Summary Card */}
        <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
          
          {/* User ID & Email row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* User ID */}
            <div className="bg-[#131E32] p-3 rounded-xl border border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Assigned User ID
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-purple-300">
                  {credentials.empId || credentials.userId}
                </span>
                <button
                  id="copy-user-id-btn"
                  type="button"
                  onClick={() => handleCopy('userId', credentials.empId || credentials.userId)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy User ID"
                >
                  {copiedField === 'userId' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Login Email */}
            <div className="bg-[#131E32] p-3 rounded-xl border border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Login Email
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-slate-200 truncate mr-2" title={credentials.email}>
                  {credentials.email}
                </span>
                <button
                  id="copy-email-btn"
                  type="button"
                  onClick={() => handleCopy('email', credentials.email)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Copy Email"
                >
                  {copiedField === 'email' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Role & Account Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* System Role */}
            <div className="bg-[#131E32] p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Assigned Role
                </span>
                <span className="text-xs font-bold text-white">
                  {credentials.role}
                </span>
              </div>
              <div className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-bold">
                App Role
              </div>
            </div>

            {/* Account Status */}
            <div className="bg-[#131E32] p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Account Status
                </span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{credentials.status || 'Active'}</span>
                </span>
              </div>
              <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                Reset Required
              </div>
            </div>
          </div>

          {/* Temporary Password Highlight Box */}
          {credentials.tempPassword && (
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                  <span>Temporary Sign-In Password</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-purple-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Show</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#0F172A] border border-purple-500/30 rounded-xl px-4 py-3">
                <span className="font-mono text-base font-extrabold tracking-wider text-white select-all">
                  {showPassword ? credentials.tempPassword : '••••••••••••••••'}
                </span>
                <button
                  id="copy-temp-password-btn"
                  type="button"
                  onClick={() => handleCopy('password', credentials.tempPassword || '')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  title="Copy Temporary Password"
                >
                  {copiedField === 'password' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            id="copy-all-credentials-btn"
            type="button"
            onClick={handleCopyAll}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">All Credentials Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-purple-400" />
                <span>Copy Full Credentials Summary</span>
              </>
            )}
          </button>

          <button
            id="done-close-credentials-btn"
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>I Have Saved Credentials &bull; Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
