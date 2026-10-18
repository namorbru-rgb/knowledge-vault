-- Family Hub: a pending self-password renewal is private server-only state.
-- An Auth admin operation must finish the request; no reset links or plaintext
-- passwords are stored in this table.
create table if not exists public.fh_password_renewals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.fh_password_renewals enable row level security;
revoke all on table public.fh_password_renewals from anon, authenticated;
comment on table public.fh_password_renewals is
  'Service-role only marker for authenticated Family Hub password renewal.';
