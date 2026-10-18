-- Video sharing with explicit owner approval.
create table if not exists public.fh_video_shares (
 owner_id uuid not null references auth.users(id),
 recipient_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(owner_id,recipient_id),
 check(owner_id<>recipient_id)
);
alter table public.fh_video_shares enable row level security;
