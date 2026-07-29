create extension if not exists "pgcrypto";

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  turtle_name text check (
    turtle_name is null
    or char_length(turtle_name) between 2 and 20
  ),
  home_district text not null default 'chelsea',
  appearance jsonb not null default jsonb_build_object('variant', 'clover'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_home_district_check check (
    home_district in (
      'chelsea',
      'central-park',
      'midtown',
      'fidi',
      'west-village',
      'east-village-les'
    )
  )
);

create table public.player_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_location text not null default 'apartment',
  last_district text not null default 'chelsea',
  location_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint player_states_last_location_check check (
    last_location in ('apartment', 'chelsea', 'central-park')
  ),
  constraint player_states_last_district_check check (
    last_district in (
      'chelsea',
      'central-park',
      'midtown',
      'fidi',
      'west-village',
      'east-village-les'
    )
  )
);

create table public.apartments (
  user_id uuid primary key references auth.users (id) on delete cascade,
  district text not null default 'chelsea',
  building_key text not null default 'west-22',
  unit_label text not null default '4B',
  tier smallint not null default 0 check (tier between 0 and 10),
  upgrades jsonb not null default '{}'::jsonb,
  furniture jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shells bigint not null default 0 check (shells >= 0),
  updated_at timestamptz not null default now()
);

create table public.item_catalog (
  item_key text primary key,
  name text not null,
  category text not null check (
    category in ('clothing', 'turtle-skin', 'furniture', 'apartment-upgrade')
  ),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null references public.item_catalog (item_key),
  quantity integer not null default 1 check (quantity >= 0),
  equipped boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

create table public.activity_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_key text not null,
  times_played integer not null default 0 check (times_played >= 0),
  best_score jsonb not null default '{}'::jsonb,
  last_result jsonb not null default '{}'::jsonb,
  last_played_at timestamptz,
  primary key (user_id, activity_key)
);

create index inventory_items_user_id_idx
on public.inventory_items (user_id);

create index activity_progress_user_id_idx
on public.activity_progress (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger player_states_set_updated_at
before update on public.player_states
for each row execute function public.set_updated_at();

create trigger apartments_set_updated_at
before update on public.apartments
for each row execute function public.set_updated_at();

create trigger wallets_set_updated_at
before update on public.wallets
for each row execute function public.set_updated_at();

create or replace function public.create_player_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.player_states (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.apartments (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_player_records();

insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.player_states (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.apartments (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;
alter table public.player_states enable row level security;
alter table public.apartments enable row level security;
alter table public.wallets enable row level security;
alter table public.item_catalog enable row level security;
alter table public.inventory_items enable row level security;
alter table public.activity_progress enable row level security;

create policy "Players can read their profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Players can update their profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Players can read their location"
on public.player_states for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Players can update their location"
on public.player_states for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Players can read their apartment"
on public.apartments for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Players can read their wallet"
on public.wallets for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Active catalog items are public"
on public.item_catalog for select
to anon, authenticated
using (is_active);

create policy "Players can read their inventory"
on public.inventory_items for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Players can read their activity progress"
on public.activity_progress for select
to authenticated
using ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select, update on public.player_states to authenticated;
grant select on public.apartments to authenticated;
grant select on public.wallets to authenticated;
grant select on public.item_catalog to anon, authenticated;
grant select on public.inventory_items to authenticated;
grant select on public.activity_progress to authenticated;
