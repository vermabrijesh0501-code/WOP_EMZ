import React, { useState } from 'react';
import { Stethoscope, ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getSupabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../services/supabase';

interface StepResult {
  name: string;
  ok: boolean | null;
  detail: string;
}

export const ConnectionDiagnostics: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);

  const run = async () => {
    setRunning(true);
    const results: StepResult[] = [];
    const push = (name: string, ok: boolean | null, detail: string) => {
      results.push({ name, ok, detail });
      setSteps([...results]);
    };

    const sb = getSupabase();
    // Step 1: client config
    push(
      'Supabase client configured',
      sb ? true : false,
      sb
        ? `URL: ${SUPABASE_URL}`
        : 'Client is NOT configured — check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env and hard-refresh (Ctrl+Shift+R)'
    );
    if (!sb) {
      setRunning(false);
      return;
    }

    // Step 2: reachable + email provider enabled
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: SUPABASE_ANON_KEY },
      });
      const settings = await res.json();
      const emailEnabled = !!settings?.external?.email;
      push(
        'Auth server reachable & Email provider enabled',
        emailEnabled,
        emailEnabled
          ? 'Reachable. Email provider: ON. Confirm email: ' + (settings?.mailer_autoconfirm ? 'OFF (good)' : 'ON — turn it OFF in dashboard')
          : `Reachable, but Email provider is OFF. Dashboard → Authentication → Providers → Email → ON`
      );
    } catch (e: any) {
      push('Auth server reachable', false, `Fetch failed: ${e?.message}. Check internet/adblock/VPN.`);
      setRunning(false);
      return;
    }

    // Step 3: user_profiles table accessible (RLS/schema check)
    try {
      const { error } = await sb.from('user_profiles').select('user_id').limit(1);
      push(
        'user_profiles table accessible',
        !error,
        error ? `Error: ${error.message} (code ${error.code})` : 'Table exists and is readable (RLS OK)'
      );
    } catch (e: any) {
      push('user_profiles table accessible', false, e?.message || 'Unknown error');
    }

    // Step 4: raw token endpoint probe (does NOT log you in; checks endpoint behavior)
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: 'diag-probe@emiza-wop-test.com', password: 'diagprobe123' }),
      });
      const body = await res.json();
      const code = body?.error_code || body?.error || body?.code;
      const known =
        res.status === 400 && (code === 'invalid_credentials' || /invalid/i.test(body?.error_description || body?.msg || ''))
          ? true
          : null;
      push(
        'Token endpoint behaves correctly',
        known,
        `HTTP ${res.status} — ${code || body?.error_description || body?.msg || 'ok'} ${
          known ? '(expected "invalid credentials" for a non-existent probe user — endpoint is healthy)' : ''
        }`
      );
    } catch (e: any) {
      push('Token endpoint behaves correctly', false, e?.message || 'Unknown error');
    }

    push('Done', true, 'If all steps above are green, login works — the issue is the entered email/password. Use verma.brijesh0501@gmail.com with any 6+ char password.');
    setRunning(false);
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 font-medium">
          <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />
          Login trouble? Run connection diagnostics
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
            {running ? 'Running...' : 'Run diagnostics'}
          </button>
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
              {s.ok === null ? (
                <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin mt-0.5 shrink-0" />
              ) : s.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
              )}
              <div>
                <span className="font-semibold text-slate-200">{s.name}</span>
                <span className="text-slate-400"> — {s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
