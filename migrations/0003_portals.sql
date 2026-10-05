alter table listings add column if not exists origin text not null default 'homezee';
alter table listings add column if not exists source text not null default 'Homezee';
alter table listings add column if not exists source_url text unique;
alter table listings add column if not exists map_query text;
alter table listings add column if not exists geo jsonb;
alter table listings add column if not exists is_demo boolean not null default false;
alter table listings add column if not exists observed_at timestamptz;
