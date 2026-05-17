-- Personen (Familienmitglieder), denen Wissen zugeordnet werden kann.
-- Idempotent; kann mehrfach ausgeführt werden.

create table if not exists kv_persons (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text default 'blue',
  emoji text default '👤',
  created_at timestamptz default now()
);

alter table kv_persons enable row level security;

drop policy if exists "user_own_persons" on kv_persons;
create policy "user_own_persons"
  on kv_persons for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table kv_videos add column if not exists person_id uuid references kv_persons(id) on delete set null;
alter table kv_links  add column if not exists person_id uuid references kv_persons(id) on delete set null;
alter table kv_photos add column if not exists person_id uuid references kv_persons(id) on delete set null;
alter table kv_notes  add column if not exists person_id uuid references kv_persons(id) on delete set null;

create index if not exists kv_persons_user_id_idx on kv_persons(user_id);
create index if not exists kv_videos_person_id_idx on kv_videos(person_id);
create index if not exists kv_links_person_id_idx  on kv_links(person_id);
create index if not exists kv_photos_person_id_idx on kv_photos(person_id);
create index if not exists kv_notes_person_id_idx  on kv_notes(person_id);
