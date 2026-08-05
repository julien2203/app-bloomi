/**
 * Parsing des deep links Supabase Auth (bloomi://auth/callback…).
 */

export type AuthCallbackIntent = 'recovery' | 'signup' | 'unknown';

export type ParsedAuthCallbackUrl = {
  intent: AuthCallbackIntent;
  accessToken: string | null;
  refreshToken: string | null;
  /** PKCE — query `code=` (robuste sur Android, contrairement au fragment). */
  code: string | null;
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

function decodeEmail(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    // Peut être double-encodé depuis redirect_to (...%2540...)
    let value = raw.trim();
    for (let i = 0; i < 2; i += 1) {
      const next = decodeURIComponent(value);
      if (next === value) break;
      value = next;
    }
    return value;
  } catch {
    return raw.trim();
  }
}

/** Parse une URL complète (query + fragment), y compris bloomi:// custom scheme. */
export function parseAuthCallbackUrl(url: string | null | undefined): ParsedAuthCallbackUrl | null {
  if (!url?.trim()) return null;

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (
    !lower.includes('auth/oauth-callback') &&
    !lower.includes('auth/callback') &&
    !trimmed.includes('type=')
  ) {
    if (!trimmed.startsWith('bloomi://auth')) return null;
  }

  let query = new URLSearchParams();
  let hash: URLSearchParams | null = null;

  // Toujours parser query/hash à la main : plus fiable que `new URL()` sur custom schemes Android.
  const [beforeHash, afterHash = ''] = trimmed.split('#');
  const qIndex = beforeHash.indexOf('?');
  if (qIndex >= 0) {
    query = parseSearchParams(beforeHash.slice(qIndex));
  }
  if (afterHash) {
    hash = parseSearchParams(`#${afterHash}`);
  }

  try {
    const parsed = new URL(trimmed);
    // Compléter si le polyfill a mieux extrait certains champs
    for (const [k, v] of parsed.searchParams.entries()) {
      if (!query.has(k)) query.set(k, v);
    }
    if (parsed.hash) {
      const fromUrlHash = parseSearchParams(parsed.hash);
      if (!hash) hash = fromUrlHash;
      else {
        for (const [k, v] of fromUrlHash.entries()) {
          if (!hash.has(k)) hash.set(k, v);
        }
      }
    }
  } catch {
    // ignore — parsing manuel déjà fait
  }

  const accessToken = hash?.get('access_token') ?? query.get('access_token');
  const refreshToken = hash?.get('refresh_token') ?? query.get('refresh_token');
  const code = query.get('code') ?? hash?.get('code');
  const tokenHash = query.get('token_hash') ?? hash?.get('token_hash');
  const token = query.get('token') ?? hash?.get('token');
  const email = decodeEmail(query.get('email') ?? hash?.get('email'));
  const errorCode =
    query.get('error_code') ?? hash?.get('error_code') ?? query.get('error') ?? hash?.get('error');

  return {
    intent: readType(query, hash),
    accessToken,
    refreshToken,
    code,
    tokenHash,
    token,
    email,
    errorCode
  };
}

export function isOAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return url.toLowerCase().includes('auth/oauth-callback');
}

export function isEmailAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const lower = url.toLowerCase();
  if (lower.includes('auth/oauth-callback')) return false;
  return lower.includes('bloomi://auth/callback') || lower.includes('/auth/callback');
}

export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  return isOAuthCallbackUrl(url) || isEmailAuthCallbackUrl(url);
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
    code?: string;
    token?: string;
    token_hash?: string;
    email?: string;
  }
): ParsedAuthCallbackUrl {
  const fromUrl = parseAuthCallbackUrl(url);
  const typeRaw = typeof params.type === 'string' ? params.type.toLowerCase() : '';
  const intentFromParam: AuthCallbackIntent | null =
    typeRaw === 'recovery'
      ? 'recovery'
      : typeRaw === 'signup' || typeRaw === 'email' || typeRaw === 'magiclink'
        ? 'signup'
        : null;

  const intent = intentFromParam ?? fromUrl?.intent ?? ('unknown' as AuthCallbackIntent);

  return {
    intent,
    accessToken:
      (typeof params.access_token === 'string' ? params.access_token : null) ??
      fromUrl?.accessToken ??
      null,
    refreshToken:
      (typeof params.refresh_token === 'string' ? params.refresh_token : null) ??
      fromUrl?.refreshToken ??
      null,
    code: (typeof params.code === 'string' ? params.code : null) ?? fromUrl?.code ?? null,
    tokenHash:
      (typeof params.token_hash === 'string' ? params.token_hash : null) ??
      fromUrl?.tokenHash ??
      null,
    token: (typeof params.token === 'string' ? params.token : null) ?? fromUrl?.token ?? null,
    email: decodeEmail(typeof params.email === 'string' ? params.email : null) ?? fromUrl?.email ?? null,
    errorCode: fromUrl?.errorCode ?? null
  };
}

/** Extrait les params auth à passer en route (évite de perdre le #fragment via rawUrl). */
export function authCallbackRouteParams(url: string): Record<string, string> {
  const parsed = parseAuthCallbackUrl(url);
  const params: Record<string, string> = { rawUrl: url };
  if (!parsed) return params;
  if (parsed.accessToken) params.access_token = parsed.accessToken;
  if (parsed.refreshToken) params.refresh_token = parsed.refreshToken;
  if (parsed.code) params.code = parsed.code;
  if (parsed.tokenHash) params.token_hash = parsed.tokenHash;
  if (parsed.token) params.token = parsed.token;
  if (parsed.email) params.email = parsed.email;
  if (parsed.intent !== 'unknown') params.type = parsed.intent;
  return params;
}
