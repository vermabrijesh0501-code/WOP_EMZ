/**
 * Credential and Security Utilities for WOP-Emiza
 * Provides cryptographically strong temporary password generation,
 * credential summaries, and clipboard helpers.
 */

export function generateSecureTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';

  const pick = (chars: string, len: number): string => {
    let res = '';
    const array = new Uint32Array(len);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
      for (let i = 0; i < len; i++) {
        res += chars[array[i] % chars.length];
      }
    } else {
      for (let i = 0; i < len; i++) {
        res += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return res;
  };

  // e.g. "Emz!" + 4 digits + 2 upper + 2 lower -> "Emz!8392ABxy"
  const prefix = 'Emz';
  const sym = pick(symbols, 1);
  const nums = pick(numbers, 4);
  const up = pick(upper, 2);
  const low = pick(lower, 2);

  return `${prefix}${sym}${nums}${up}${low}`;
}

export interface CredentialSummaryParams {
  userId: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  status: string;
  tempPassword?: string;
  loginUrl?: string;
}

export function formatCredentialSummary(params: CredentialSummaryParams): string {
  const portalUrl = params.loginUrl || (typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://wop-emiza.app/login');
  
  return [
    '=========================================',
    '  WOP-EMIZA WAREHOUSE OPERATIONS PLATFORM',
    '       NEW USER ACCESS CREDENTIALS       ',
    '=========================================',
    `Full Name:          ${params.name}`,
    `Assigned User ID:   ${params.userId}`,
    `Login Email:        ${params.email}`,
    params.tempPassword ? `Temporary Password: ${params.tempPassword}` : null,
    `System Role:        ${params.role}`,
    params.department ? `Department:         ${params.department}` : null,
    `Account Status:     ${params.status} (Password change required on first login)`,
    '-----------------------------------------',
    'SECURITY NOTICE:',
    '- This temporary password is valid for first sign-in only.',
    '- You will be required to establish a new personal password immediately upon login.',
    '- Do not share this temporary password with unauthorized personnel.',
    '-----------------------------------------',
    `Login Portal:       ${portalUrl}`,
    '=========================================',
  ].filter(Boolean).join('\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard writeText failed, using fallback:', err);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}
