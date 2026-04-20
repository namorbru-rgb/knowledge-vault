-- Kategorien und Link-Erweiterungen (Titel bearbeitbar, eigene Bemerkung, Kategorie).
-- Idempotent; kann mehrfach ausgeführt werden.

create table if not exists kv_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text default 'blue',
  created_at timestamptz default now()
);

alter table kv_categories enable row level security;

drop policy if exists "user_own_categories" on kv_categories;
create policy "user_own_categories"
  on kv_categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table kv_links
  add column if not exists notes text,
  add column if not exists category_id uuid references kv_categories(id) on delete set null;

create index if not exists kv_links_category_id_idx on kv_links(category_id);
create index if not exists kv_categories_user_id_idx on kv_categories(user_id);
