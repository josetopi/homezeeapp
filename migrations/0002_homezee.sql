create table if not exists profiles (
  user_id text primary key,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  role text not null default 'buyer',
  is_admin boolean not null default false,
  is_pro boolean not null default false,
  pro_plan text,
  onboarded boolean not null default false,
  is_seed boolean not null default false,
  swipe_count_today int not null default 0,
  swipe_date date,
  filter_location text not null default '',
  filter_max_price int,
  filter_property_type text not null default 'any',
  filter_min_bedrooms int not null default 0,
  taste jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id serial primary key,
  seller_id text not null,
  title text not null,
  address text not null,
  city text not null,
  neighborhood text not null default '',
  state text not null,
  price int not null,
  bedrooms int not null,
  bathrooms numeric(3,1) not null,
  sqft int not null,
  lot_sqft int,
  year_built int,
  property_type text not null,
  style text not null default 'modern',
  description text not null default '',
  status text not null default 'active',
  promoted boolean not null default false,
  promoted_until timestamptz,
  photos text[] not null default '{}',
  sale_handling text,
  created_at timestamptz not null default now()
);
create index if not exists listings_status_idx on listings (status);
create index if not exists listings_seller_idx on listings (seller_id);
create index if not exists listings_city_idx on listings (city);

create table if not exists swipes (
  id serial primary key,
  user_id text not null,
  listing_id int not null references listings(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);
create index if not exists swipes_user_idx on swipes (user_id);

create table if not exists favorites (
  user_id text not null,
  listing_id int not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists visits (
  id serial primary key,
  listing_id int not null references listings(id) on delete cascade,
  buyer_id text not null,
  seller_id text not null,
  status text not null default 'requested',
  proposed_slots jsonb not null default '[]'::jsonb,
  confirmed_slot timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visits_buyer_idx on visits (buyer_id);
create index if not exists visits_seller_idx on visits (seller_id);

create table if not exists conversations (
  id serial primary key,
  listing_id int not null references listings(id) on delete cascade,
  buyer_id text not null,
  seller_id text not null,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id, seller_id)
);

create table if not exists messages (
  id serial primary key,
  conversation_id int not null references conversations(id) on delete cascade,
  sender_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_convo_idx on messages (conversation_id);

create table if not exists offers (
  id serial primary key,
  listing_id int not null references listings(id) on delete cascade,
  buyer_id text not null,
  seller_id text not null,
  visit_id int not null references visits(id),
  amount int not null,
  status text not null default 'pending',
  counter_amount int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transactions (
  id serial primary key,
  listing_id int not null,
  buyer_id text not null,
  seller_id text not null,
  offer_id int,
  sale_price int not null,
  handle_independently boolean not null default false,
  platform_fee int not null default 0,
  agent_fee int not null default 0,
  agent_id text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists agent_applications (
  id serial primary key,
  user_id text not null unique,
  license_number text not null,
  coverage_area text not null,
  specialty text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id serial primary key,
  user_id text not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, read);

create table if not exists market_snapshots (
  id serial primary key,
  city text not null,
  month text not null,
  avg_price int not null,
  listing_count int not null,
  avg_psf int not null
);
create index if not exists market_city_idx on market_snapshots (city);
