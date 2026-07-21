-- Run this in the Supabase SQL editor (https://supabase.com/dashboard/project/_/sql/new)

create table notes (
  id text primary key,
  title text not null,
  content text default '',
  category text default 'thinking',
  tag text default null,
  date text not null
);

create table work (
  id text primary key,
  number text default '',
  year text default '',
  label text default '',
  title text not null,
  description text default '',
  link text default '',
  style text default 'sunrise',
  large boolean default false,
  quote text default '',
  tag text default null
);

create table now (
  id text primary key,
  category text not null,
  description text not null,
  italic boolean default false
);

create table legacy (
  id text primary key,
  platform text default 'youtube',
  title text not null,
  link text default '',
  content text default '',
  date text not null
);

-- Enable Row Level Security (recommended)
alter table notes enable row level security;
alter table work enable row level security;
alter table now enable row level security;
alter table legacy enable row level security;

-- Allow public read/write access via anon key
grant all on public.notes to anon;
grant all on public.work to anon;
grant all on public.now to anon;
grant all on public.legacy to anon;

create policy "Allow all on notes" on notes for all using (true) with check (true);
create policy "Allow all on work" on work for all using (true) with check (true);
create policy "Allow all on now" on now for all using (true) with check (true);
create policy "Allow all on legacy" on legacy for all using (true) with check (true);
