-- Knowledge-only OAuth broker state. No direct access from browser/anonymous roles.
create table public.kv_mcp_oauth_clients (
 id uuid primary key default gen_random_uuid(), client_name text not null,
 redirect_uris jsonb not null, created_at timestamptz not null default now()
);
create table public.kv_mcp_oauth_codes (
 id uuid primary key default gen_random_uuid(), code_hash text not null unique,
 client_id uuid not null references public.kv_mcp_oauth_clients(id),
 redirect_uri text not null, code_challenge text not null,
 gotrue_refresh_token text not null, user_email text not null,
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table public.kv_mcp_oauth_sessions (
 id uuid primary key default gen_random_uuid(), refresh_hash text not null unique,
 access_hash text not null unique,
 client_id uuid not null references public.kv_mcp_oauth_clients(id),
 gotrue_refresh_token text not null, user_email text not null,
 created_at timestamptz not null default now(), last_used_at timestamptz,
 revoked_at timestamptz
);
create index kv_mcp_oauth_codes_expiry_idx on public.kv_mcp_oauth_codes(expires_at);
create index kv_mcp_oauth_session_client_idx on public.kv_mcp_oauth_sessions(client_id);
alter table public.kv_mcp_oauth_clients enable row level security;
alter table public.kv_mcp_oauth_codes enable row level security;
alter table public.kv_mcp_oauth_sessions enable row level security;
revoke all on public.kv_mcp_oauth_clients,public.kv_mcp_oauth_codes,public.kv_mcp_oauth_sessions from public,anon,authenticated;

-- The broker records the SHA-256 of each current access JWT. This binds it to
-- THIS OAuth flow/resource without ever exposing its client record to callers.
create function public.kv_mcp_oauth_access_active(p_hash text)
returns boolean language sql stable security definer set search_path=''
as $$
 select length(p_hash)=64 and p_hash ~ '^[0-9a-f]{64}$'
    and exists(select 1 from public.kv_mcp_oauth_sessions s
       where s.access_hash=p_hash and s.revoked_at is null);
$$;
revoke all on function public.kv_mcp_oauth_access_active(text) from public;
grant execute on function public.kv_mcp_oauth_access_active(text) to anon,authenticated;