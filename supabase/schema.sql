drop table if exists notes, work, legacy, now, posts, projects, links;

create table posts (
  id text primary key,
  title text not null,
  content text default '',
  category text default 'general',
  tags text[] default '{}',
  date text not null,
  featured_image text default ''
);

create table projects (
  id text primary key,
  title text not null,
  description text default '',
  tags text[] default '{}',
  year text default '',
  number text default '',
  style text default 'sunrise',
  large boolean default false,
  quote text default ''
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
  content text default '',
  link text default '',
  date text not null
);

create table links (
  id text primary key,
  title text not null,
  url text not null,
  category text default ''
);

alter table posts enable row level security;
alter table projects enable row level security;
alter table now enable row level security;
alter table legacy enable row level security;
alter table links enable row level security;

grant all on public.posts to anon;
grant all on public.projects to anon;
grant all on public.now to anon;
grant all on public.legacy to anon;
grant all on public.links to anon;

create policy "Allow all on posts" on posts for all using (true) with check (true);
create policy "Allow all on projects" on projects for all using (true) with check (true);
create policy "Allow all on now" on now for all using (true) with check (true);
create policy "Allow all on legacy" on legacy for all using (true) with check (true);
create policy "Allow all on links" on links for all using (true) with check (true);
