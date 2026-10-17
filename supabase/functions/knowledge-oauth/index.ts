// KnowledgeOAuth — abgeschotteter OAuth-Broker für KnowledgeVault.
//
// Zweck: MCP-Clients ohne Header-Unterstützung (ChatGPT-Konnektor) melden sich
// per OAuth an. Der Broker stellt KEINE eigene Identität aus: Access-Tokens
// sind echte Supabase-GoTrue-JWTs des angemeldeten Mitarbeiters — knowledge-mcp
// prüft sie unverändert je Aufruf gegen GoTrue und löst Identität/Team/Rolle
// serverseitig auf (Mitarbeiter-Zone). Der Broker verwaltet nur den Weg dahin:
//
//   RFC 8414  GET  /.well-known/oauth-authorization-server   (Metadata)
//   RFC 7591  POST /register                                  (Dynamic Client Registration)
//   RFC 6749  GET/POST /authorize                             (Login-Seite gegen GoTrue)
//   RFC 6749  POST /token                                     (Code-Tausch + Refresh, PKCE S256 Pflicht)
//
// Sicherheitsregeln (fail closed):
// - PKCE S256 ist Pflicht; Codes sind Einweg und 10 Minuten gültig.
// - redirect_uri: exakter Stringvergleich gegen die Registrierung; nur https,
//   keine IP-/localhost-Hosts.
// - Login nur für Konten mit app_users-Eintrag UND aktiver app_memberships-
//   Zeile (gleiche Bedingung wie die Mitarbeiter-Zone in knowledge-mcp); sonst wird
//   die frisch erzeugte GoTrue-Session sofort wieder beendet.
// - Refresh-Handles und Codes liegen nur als SHA-256-Hash in der DB
//   (service-only Tabellen kv_mcp_oauth_*); GoTrue-Refresh-Tokens rotieren bei
//   jedem Gebrauch mit.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = (Deno.env.get('KAMA_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const ISSUER = `${SUPABASE_URL}/functions/v1/knowledge-oauth`;
const RESOURCE = `${SUPABASE_URL}/functions/v1/knowledge-mcp`;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_REDIRECT_URIS = 5;

// Das Login-Formular liegt als öffentliche Route in der App (kama-net.com):
// das Supabase-Gateway neutralisiert text/html von Edge Functions zu
// text/plain + CSP-Sandbox (Anti-Phishing auf der Projekt-Domain) — eine
// Function kann die Seite also nie selbst rendern. GET /authorize leitet
// deshalb aufs App-Formular um; das Formular POSTet klassisch hierher zurück
// (Redirects sind vom Gateway unberührt).
const APP_ORIGIN = Deno.env.get('KNOWLEDGE_APP_ORIGIN') ?? 'https://namorbru-rgb.github.io/knowledge-vault';
const LOGIN_FORM_URL = `${APP_ORIGIN}/#/oauth-authorize`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, mcp-protocol-version',
};

// ── Helpers ────────────────────────────────────────────────────────────────
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function s256Challenge(verifier: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(buf));
}

function randomToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}_${b64url(bytes)}`;
}

async function restJson<T>(pathAndQuery: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`rest ${pathAndQuery}: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...extra },
  });
}

function oauthError(error: string, description: string, status = 400): Response {
  return json({ error, error_description: description }, status);
}

// ── Redirect-URI-Validierung (nur https, keine IP/localhost, exakter Match) ─
function redirectUriAcceptable(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch (_err) {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.hash) return false;
  const host = u.hostname;
  if (host === 'localhost' || host.endsWith('.localhost') || /^[0-9.:[\]]+$/.test(host)) return false;
  return true;
}

// ── GoTrue ────────────────────────────────────────────────────────────────
type GotrueSession = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string };
};

async function gotrue(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: GotrueSession }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as GotrueSession;
  return { ok: res.ok, status: res.status, data };
}

// Nur eine definitive GoTrue-Ablehnung entwertet Grant/Session; 429/5xx sind
// transient und dürfen den Nutzer nicht dauerhaft abmelden (Codex-P2).
function gotrueDefinitiveReject(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 422;
}

async function gotrueLogout(accessToken: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
  }).catch(() => undefined);
}

// Gleiche Bedingung wie die Mitarbeiter-Zone in knowledge-mcp: app_users-Eintrag
// (per Auth-UID, Fallback E-Mail) plus mindestens eine Team-Mitgliedschaft.
// Authentifizierte private Knowledge-Nutzer; Datenzugriff bleibt per RPC auf
// eigene bzw. ausdrücklich freigegebene Bibliotheken eingeschränkt.
async function hasAppMembership(authUserId: string, email: string | undefined): Promise<boolean> {
  return Boolean(authUserId && email);
}

// ── Login-Formular (gehostet in der App, siehe LOGIN_FORM_URL) ─────────────
const OAUTH_PARAM_KEYS = ['response_type', 'client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource'] as const;

// 302 aufs App-Formular — trägt die OAuth-Parameter, den Anzeigenamen des
// Clients und optional eine Fehlermeldung als Query im Hash-Fragment.
function loginFormRedirect(params: Record<string, string>, clientName: string, errorMessage = ''): Response {
  const qs = new URLSearchParams();
  for (const k of OAUTH_PARAM_KEYS) if (params[k]) qs.set(k, params[k]);
  qs.set('client_name', clientName);
  if (errorMessage) qs.set('error', errorMessage);
  return new Response(null, {
    status: 302,
    headers: { Location: `${LOGIN_FORM_URL}?${qs.toString()}`, 'Cache-Control': 'no-store' },
  });
}

// ── Endpoints ──────────────────────────────────────────────────────────────
// Hinweis (Codex-P1): Die pfad-eingefügte RFC-8414-Discovery-URL
// (https://<host>/.well-known/oauth-authorization-server/functions/v1/knowledge-oauth)
// liegt an der Domain-Root und ist am Supabase-Gateway nicht routbar — wir
// kontrollieren nur /functions/v1/*. Die MCP-Auth-Spec verpflichtet Clients
// auf die pfad-angehängte Fallback-Form (…/knowledge-oauth/.well-known/…), die
// hier bedient wird; zusätzlich enthält das Dokument die OIDC-Pflichtfelder
// (jwks_uri der GoTrue-Instanz, subject_types_supported), damit auch
// openid-configuration-Konsumenten es akzeptieren.
function metadata(): Response {
  return json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    registration_endpoint: `${ISSUER}/register`,
    jwks_uri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256', 'ES256'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['knowledge:read'],
    service_documentation: 'https://github.com/namorbru-rgb/knowledge-vault/blob/main/docs/KNOWLEDGE_MCP.md',
  });
}

// Verwaiste/abgelaufene Codes tragen GoTrue-Refresh-Tokens — opportunistisch
// bei jedem Authorize-/Token-Aufruf entsorgen (Codex-P2, kein Cron nötig).
async function purgeExpiredCodes(): Promise<void> {
  await restJson(`kv_mcp_oauth_codes?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, { method: 'DELETE' })
    .catch(() => undefined);
}

async function handleRegister(req: Request): Promise<Response> {
  let body: { redirect_uris?: unknown; client_name?: unknown };
  try {
    body = await req.json();
  } catch (_err) {
    return oauthError('invalid_client_metadata', 'JSON-Body erforderlich.');
  }
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!uris.length || uris.length > MAX_REDIRECT_URIS || !uris.every(redirectUriAcceptable)) {
    return oauthError('invalid_redirect_uri', 'redirect_uris: 1–5 https-URLs ohne Fragment, keine IP-/localhost-Hosts.');
  }
  const clientName = String(body.client_name ?? '').trim().slice(0, 120) || 'MCP-Client';
  const rows = await restJson<{ id: string }[]>('kv_mcp_oauth_clients', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ client_name: clientName, redirect_uris: uris }),
  });
  return json({
    client_id: rows[0].id,
    client_name: clientName,
    redirect_uris: uris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  }, 201);
}

type OauthClient = { id: string; client_name: string; redirect_uris: string[] };

async function loadClient(clientId: string): Promise<OauthClient | null> {
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return null;
  const rows = await restJson<OauthClient[]>(
    `kv_mcp_oauth_clients?id=eq.${clientId}&select=id,client_name,redirect_uris&limit=1`,
  );
  return rows[0] ?? null;
}

function validateAuthorizeParams(params: Record<string, string>, client: OauthClient | null): string | null {
  if (!client) return 'Unbekannter client_id.';
  if (params.resource && params.resource !== RESOURCE) return 'resource muss Knowledge MCP entsprechen.';
  if (params.response_type !== 'code') return 'Nur response_type=code wird unterstützt.';
  if (!client.redirect_uris.includes(params.redirect_uri ?? '')) return 'redirect_uri ist für diesen Client nicht registriert.';
  if (params.code_challenge_method !== 'S256') return 'PKCE mit S256 ist Pflicht.';
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(params.code_challenge ?? '')) return 'code_challenge fehlt oder ist ungültig.';
  return null;
}

async function handleAuthorizeGet(url: URL): Promise<Response> {
  const params: Record<string, string> = {};
  for (const k of OAUTH_PARAM_KEYS) params[k] = url.searchParams.get(k) ?? '';
  const client = await loadClient(params.client_id);
  const problem = validateAuthorizeParams(params, client);
  // Ungültige Grunddaten NIE per Redirect beantworten (Open-Redirect-Schutz).
  if (problem) return new Response(`Anfrage ungültig: ${problem}`, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return loginFormRedirect(params, client!.client_name);
}

async function handleAuthorizePost(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) return new Response('Formulardaten erwartet.', { status: 400 });
  const params: Record<string, string> = {};
  for (const k of OAUTH_PARAM_KEYS) params[k] = String(form.get(k) ?? '');
  const client = await loadClient(params.client_id);
  const problem = validateAuthorizeParams(params, client);
  if (problem) return new Response(`Anfrage ungültig: ${problem}`, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const consent = String(form.get('consent') ?? '');
  if (consent !== 'yes') return loginFormRedirect(params, client!.client_name, 'Die Freigabe muss aktiv bestätigt werden.');
  if (!email || !password) return loginFormRedirect(params, client!.client_name, 'E-Mail und Passwort eingeben.');

  const grant = await gotrue('token?grant_type=password', { email, password });
  if (!grant.ok || !grant.data.access_token || !grant.data.refresh_token || !grant.data.user?.id) {
    return loginFormRedirect(params, client!.client_name, 'Anmeldung fehlgeschlagen — E-Mail oder Passwort falsch.');
  }

  const member = await hasAppMembership(grant.data.user.id, grant.data.user.email ?? email).catch(() => false);
  if (!member) {
    await gotrueLogout(grant.data.access_token);
    return loginFormRedirect(params, client!.client_name, 'Dieses Konto ist nicht für Family Hub aktiviert.');
  }

  await purgeExpiredCodes();
  const code = randomToken('kac');
  await restJson('kv_mcp_oauth_codes', {
    method: 'POST',
    body: JSON.stringify({
      code_hash: await sha256Hex(code),
      client_id: client!.id,
      redirect_uri: params.redirect_uri,
      code_challenge: params.code_challenge,
      gotrue_refresh_token: grant.data.refresh_token,
      user_email: grant.data.user.email ?? email,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    }),
  });

  const target = new URL(params.redirect_uri);
  target.searchParams.set('code', code);
  if (params.state) target.searchParams.set('state', params.state);
  return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store' } });
}

function tokenResponse(session: GotrueSession, refreshHandle: string): Response {
  return json({
    access_token: session.access_token,
    token_type: 'bearer',
    expires_in: session.expires_in ?? 3600,
    refresh_token: refreshHandle,
    scope: 'knowledge:read',
  });
}

async function handleToken(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) return oauthError('invalid_request', 'application/x-www-form-urlencoded erwartet.');
  const grantType = String(form.get('grant_type') ?? '');

  if (grantType === 'authorization_code') {
    const code = String(form.get('code') ?? '');
    const verifier = String(form.get('code_verifier') ?? '');
    const clientId = String(form.get('client_id') ?? '');
    const redirectUri = String(form.get('redirect_uri') ?? '');
    if (form.get('resource') && String(form.get('resource')) !== RESOURCE) return oauthError('invalid_target', 'Falsche MCP-Ressource.');
    if (!code || !verifier) return oauthError('invalid_request', 'code und code_verifier sind Pflicht.');

    await purgeExpiredCodes();
    const codeHash = await sha256Hex(code);
    // Einweg atomar (Codex-P2): DELETE mit return=representation konsumiert
    // und liest den Code in EINER DB-Operation — bei parallelen Anfragen
    // bekommt genau eine die Zeile, alle anderen gehen leer aus.
    const rows = await restJson<{
      id: string; client_id: string; redirect_uri: string; code_challenge: string;
      gotrue_refresh_token: string; user_email: string; expires_at: string;
    }[]>(`kv_mcp_oauth_codes?code_hash=eq.${codeHash}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    const row = rows?.[0];
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return oauthError('invalid_grant', 'Code unbekannt, verbraucht oder abgelaufen.');
    }
    if (row.client_id !== clientId || row.redirect_uri !== redirectUri) {
      return oauthError('invalid_grant', 'client_id/redirect_uri passen nicht zum Code.');
    }
    if (await s256Challenge(verifier) !== row.code_challenge) {
      return oauthError('invalid_grant', 'PKCE-Verifizierung fehlgeschlagen.');
    }

    const refreshed = await gotrue('token?grant_type=refresh_token', { refresh_token: row.gotrue_refresh_token });
    if (!refreshed.ok || !refreshed.data.access_token || !refreshed.data.refresh_token) {
      if (refreshed.ok || !gotrueDefinitiveReject(refreshed.status)) {
        return oauthError('temporarily_unavailable', 'Login-Dienst vorübergehend nicht erreichbar — bitte kurz warten und erneut versuchen.', 503);
      }
      return oauthError('invalid_grant', 'Sitzung nicht mehr gültig — bitte erneut anmelden.');
    }

    const handle = randomToken('kar');
    await restJson('kv_mcp_oauth_sessions', {
      method: 'POST',
      body: JSON.stringify({
        refresh_hash: await sha256Hex(handle),
        access_hash: await sha256Hex(refreshed.data.access_token),
        client_id: row.client_id,
        gotrue_refresh_token: refreshed.data.refresh_token,
        user_email: row.user_email,
      }),
    });
    return tokenResponse(refreshed.data, handle);
  }

  if (grantType === 'refresh_token') {
    const handle = String(form.get('refresh_token') ?? '');
    if (!handle) return oauthError('invalid_request', 'refresh_token ist Pflicht.');
    const refreshHash = await sha256Hex(handle);
    const rows = await restJson<{ id: string; gotrue_refresh_token: string; client_id: string }[]>(
      `kv_mcp_oauth_sessions?refresh_hash=eq.${refreshHash}&revoked_at=is.null&select=id,gotrue_refresh_token,client_id&limit=1`,
    );
    const session = rows[0];
    if (!session) return oauthError('invalid_grant', 'Refresh-Token unbekannt oder widerrufen.');
    if (String(form.get('client_id') ?? '') !== session.client_id) return oauthError('invalid_grant', 'Client nicht autorisiert.');

    const refreshed = await gotrue('token?grant_type=refresh_token', { refresh_token: session.gotrue_refresh_token });
    if (!refreshed.ok || !refreshed.data.access_token || !refreshed.data.refresh_token) {
      // Transient (429/5xx/Netz): Session behalten, Client soll es erneut
      // versuchen. Nur eine definitive GoTrue-Ablehnung widerruft (Codex-P2).
      if (refreshed.ok || !gotrueDefinitiveReject(refreshed.status)) {
        return oauthError('temporarily_unavailable', 'Login-Dienst vorübergehend nicht erreichbar — bitte kurz warten und erneut versuchen.', 503);
      }
      await restJson(`kv_mcp_oauth_sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      });
      return oauthError('invalid_grant', 'Sitzung abgelaufen — bitte erneut anmelden.');
    }

    // Rotation: neues Handle + neues GoTrue-Refresh-Token in derselben Zeile.
    const nextHandle = randomToken('kar');
    await restJson(`kv_mcp_oauth_sessions?id=eq.${session.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        refresh_hash: await sha256Hex(nextHandle),
        access_hash: await sha256Hex(refreshed.data.access_token),
        gotrue_refresh_token: refreshed.data.refresh_token,
        last_used_at: new Date().toISOString(),
      }),
    });
    return tokenResponse(refreshed.data, nextHandle);
  }

  return oauthError('unsupported_grant_type', 'Nur authorization_code und refresh_token.');
}

// ── Routing ────────────────────────────────────────────────────────────────
async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return oauthError('temporarily_unavailable', 'OAuth-Broker nicht konfiguriert.', 503);
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/knowledge-oauth/, '') || '/';

  if (req.method === 'GET' && (path === '/.well-known/oauth-authorization-server' || path === '/.well-known/openid-configuration')) {
    return metadata();
  }
  if (req.method === 'POST' && path === '/register') return await handleRegister(req);
  if (req.method === 'GET' && path === '/authorize') return await handleAuthorizeGet(url);
  if (req.method === 'POST' && path === '/authorize') return await handleAuthorizePost(req);
  if (req.method === 'POST' && path === '/token') return await handleToken(req);

  if (req.method === 'GET' && (path === '/' || path === '')) {
    return json({ service: 'knowledge-oauth', resource: RESOURCE, metadata: `${ISSUER}/.well-known/oauth-authorization-server` });
  }
  return oauthError('invalid_request', `Unbekannter Endpoint: ${req.method} ${path}`, 404);
}

serve(async (req) => {
  try {
    return await handleRequest(req);
  } catch (_err) {
    return oauthError('server_error', 'Interner Fehler.', 500);
  }
});
