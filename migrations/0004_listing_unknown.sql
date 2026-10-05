alter table listings add column if not exists bedrooms_unknown boolean not null default false;
alter table listings add column if not exists area_unknown boolean not null default false;
alter table listings alter column sqft type numeric using sqft::numeric;
