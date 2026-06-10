/**
 * Parsing des deep links Supabase Auth (bloomi://auth/callback…).
 */

export type AuthCallbackIntent = 'recovery' | 'signup' | 'unknown';

export type ParsedAuthCallbackUrl = {
  intent: AuthCallbackIntent;
  accessToken: string | null;
  refreshToken: string | null;
  /** PKCE / template email */
  tokenHash: string | null;
  /** OTP 6 chiffres (signup legacy) */
  token: string | null;
  email: string | null;
  errorCode: string | null;
};

function parseSearchParams(part: string): URLSearchParams {
  const trimmed = part.startsWith('?') || part.startsWith('#') ? part.slice(1) : part;
  return new URLSearchParams(trimmed);
}

function readType(query: URLSearchParams, hash: URLSearchParams | null): AuthCallbackIntent {
  const raw = (query.get('type') ?? hash?.get('type') ?? '').toLowerCase();
  if (raw === 'recovery') return 'recovery';
  if (raw === 'signup' || raw === 'email' || raw === 'magiclink') return 'signup';
  return 'unknown';
}

/** Parse une URL complète (query + fragment). */
export function parseAuthCallbackUrl(url: string | null | undefined): ParsedAuthCallbackUrl | null {
  if (!url?.trim()) return null;

  const trimmed = url.trim();
  if (!trimmed.toLowerCase().includes('auth/callback') && !trimmed.includes('type=')) {
    if (!trimmed.startsWith('bloomi://auth')) return null;
  }

  let query = new URLSearchParams();
  let hash: URLSearchParams | null = null;

  try {
    const parsed = new URL(trimmed);
    query = parsed.searchParams;
    if (parsed.hash) {
      hash = parseSearchParams(parsed.hash);
    }
  } catch {
    const [beforeHash, afterHash] = trimmed.split('#');
    const qIndex = beforeHash.indexOf('?');
    if (qIndex >= 0) {
      query = parseSearchParams(beforeHash.slice(qIndex));
    }
    if (afterHash) {
      hash = parseSearchParams(`#${afterHash}`);
    }
  }

  const accessToken = hash?.get('access_token') ?? query.get('access_token');
  const refreshToken = hash?.get('refresh_token') ?? query.get('refresh_token');
  const tokenHash = query.get('token_hash') ?? hash?.get('token_hash');
  const token = query.get('token') ?? hash?.get('token');
  const email = query.get('email') ?? hash?.get('email');
  const errorCode = query.get('error_code') ?? hash?.get('error_code') ?? query.get('error') ?? null;

  return {
    intent: readType(query, hash),
    accessToken,
    refreshToken,
    tokenHash,
    token,
    email,
    errorCode
  };
}

export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const lower = url.toLowerCase();
  return lower.includes('bloomi://auth/callback') || lower.includes('/auth/callback');
}

export function isPasswordRecoveryUrl(url: string | null | undefined): boolean {
  return parseAuthCallbackUrl(url)?.intent === 'recovery';
}

export function mergeAuthCallback(
  url: string | null | undefined,
  params: {
    type?: string;
    access_token?: string;
    refresh_token?: string;
    token?: string;
    token_hash?: string;
    email?: string;
  }
): ParsedAuthCallbackUrl {
  const fromUrl = parseAuthCallbackUrl(url);
  const intentFromParam =
    typeof params.type === 'string' && params.type.toLowerCase() === 'recovery'
      ? 'recovery'
      : typeof params.type === 'string' && params.type.toLowerCase() === 'signup'
        ? 'signup'
        : null;

  const intent =
    intentFromParam ??
    fromUrl?.intent ??
    ('unknown' as AuthCallbackIntent);

  return {
    intent: intent === 'unknown' && fromUrl?.intent !== 'unknown' ? fromUrl.intent : intent,
    accessToken:
      (typeof params.access_token === 'string' ? params.access_token : null) ??
      fromUrl?.accessToken ??
      null,
    refreshToken:
      (typeof params.refresh_token === 'string' ? params.refresh_token : null) ??
      fromUrl?.refreshToken ??
      null,
    tokenHash:
      (typeof params.token_hash === 'string' ? params.token_hash : null) ??
      fromUrl?.tokenHash ??
      null,
    token: (typeof params.token === 'string' ? params.token : null) ?? fromUrl?.token ?? null,
    email: (typeof params.email === 'string' ? params.email : null) ?? fromUrl?.email ?? null,
    errorCode: fromUrl?.errorCode ?? null
  };
}
