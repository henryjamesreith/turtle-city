create table public.game_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid not null,
  activity_key text not null,
  shells integer not null check (shells > 0),
  awarded_at timestamptz not null default now(),
  primary key (user_id, run_id)
);

alter table public.game_rewards enable row level security;

create policy "Players can read their game rewards"
on public.game_rewards for select to authenticated
using ((select auth.uid()) = user_id);

grant select on public.game_rewards to authenticated;

create or replace function public.award_game_win(p_activity_key text, p_run_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward integer;
  balance bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  reward := case p_activity_key
    when 'hockey' then 30
    when 'snow-shoveling' then 20
    when 'pressure-washing' then 20
    when 'falling-items' then 15
    when 'trash-pickup' then 15
    when 'shell-express' then 25
    when 'rail-rush' then 15
    when 'bike-race' then 30
    when 'rhythm-game' then 20
    else null
  end;
  if reward is null then raise exception 'Unknown activity'; end if;

  insert into public.game_rewards (user_id, run_id, activity_key, shells)
  values (auth.uid(), p_run_id, p_activity_key, reward)
  on conflict do nothing;

  if found then
    update public.wallets set shells = shells + reward
    where user_id = auth.uid() returning shells into balance;
  else
    select shells into balance from public.wallets where user_id = auth.uid();
  end if;
  return balance;
end;
$$;

create or replace function public.upgrade_apartment()
returns table(shells bigint, tier smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_tier smallint;
  upgrade_cost integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select a.tier into current_tier from public.apartments a where a.user_id = auth.uid() for update;
  if current_tier >= 3 then raise exception 'Apartment is fully upgraded'; end if;
  upgrade_cost := case current_tier when 0 then 50 when 1 then 125 else 250 end;
  update public.wallets w set shells = w.shells - upgrade_cost
  where w.user_id = auth.uid() and w.shells >= upgrade_cost;
  if not found then raise exception 'Not enough shells'; end if;
  update public.apartments a set tier = current_tier + 1 where a.user_id = auth.uid();
  return query select w.shells, (current_tier + 1)::smallint from public.wallets w where w.user_id = auth.uid();
end;
$$;

grant execute on function public.award_game_win(text, uuid) to authenticated;
grant execute on function public.upgrade_apartment() to authenticated;
