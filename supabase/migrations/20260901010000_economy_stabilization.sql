drop function if exists public.award_game_win(text, uuid);

create function public.award_game_win(p_activity_key text, p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  reward integer;
  balance bigint;
  should_award boolean := false;
  daily_rewards integer;
begin
  if player_id is null then raise exception 'Authentication required.' using errcode = '28000'; end if;

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
    when 'excavator' then 25
    else null
  end;
  if reward is null then raise exception 'Unknown activity.' using errcode = 'P0002'; end if;

  select shells into balance from public.wallets where user_id = player_id for update;
  if balance is null then raise exception 'Player wallet is unavailable.' using errcode = 'P0002'; end if;

  if exists (select 1 from public.game_rewards where user_id = player_id and run_id = p_run_id) then
    return jsonb_build_object('awarded', false, 'shells', balance);
  end if;

  select count(*) into daily_rewards
  from public.game_rewards
  where user_id = player_id and awarded_at >= date_trunc('day', now());

  should_award := daily_rewards < 8 and not exists (
    select 1 from public.game_rewards
    where user_id = player_id
      and activity_key = p_activity_key
      and awarded_at > now() - interval '5 minutes'
  );

  if should_award then
    insert into public.game_rewards (user_id, run_id, activity_key, shells)
    values (player_id, p_run_id, p_activity_key, reward);

    update public.wallets set shells = shells + reward
    where user_id = player_id returning shells into balance;
  end if;

  insert into public.activity_progress (
    user_id, activity_key, times_played, best_score, last_result, last_played_at
  ) values (
    player_id,
    p_activity_key,
    1,
    jsonb_build_object('wins', 1),
    jsonb_build_object('won', true, 'rewarded', should_award, 'shells', case when should_award then reward else 0 end),
    now()
  )
  on conflict (user_id, activity_key) do update set
    times_played = public.activity_progress.times_played + 1,
    best_score = jsonb_build_object(
      'wins', coalesce((public.activity_progress.best_score->>'wins')::integer, 0) + 1
    ),
    last_result = excluded.last_result,
    last_played_at = excluded.last_played_at;

  return jsonb_build_object('awarded', should_award, 'shells', balance);
end;
$$;

revoke all on function public.award_game_win(text, uuid) from public;
revoke all on function public.award_game_win(text, uuid) from anon;
grant execute on function public.award_game_win(text, uuid) to authenticated;

-- Preserve legacy tier purchases by converting them into the itemized upgrades
-- that now form the single apartment progression system.
insert into public.inventory_items (user_id, item_key, equipped, metadata)
select a.user_id, legacy.item_key, true, jsonb_build_object('source', 'legacy-apartment-tier')
from public.apartments a
cross join lateral (
  values
    (1, 'apartment-warm-lights'),
    (2, 'apartment-fresh-walls'),
    (3, 'apartment-comfy-bed')
) as legacy(required_tier, item_key)
where a.tier >= legacy.required_tier
on conflict (user_id, item_key) do nothing;

update public.apartments a
set
  upgrades = coalesce(a.upgrades, '{}'::jsonb) || coalesce((
    select jsonb_object_agg(i.item_key, true)
    from public.inventory_items i
    where i.user_id = a.user_id
      and i.item_key in (
        'apartment-warm-lights',
        'apartment-fresh-walls',
        'apartment-comfy-bed'
      )
  ), '{}'::jsonb),
  tier = least(3, (
    select count(*)::smallint
    from public.inventory_items i
    where i.user_id = a.user_id
      and i.item_key in (
        'apartment-warm-lights',
        'apartment-fresh-walls',
        'apartment-comfy-bed'
      )
  ));

revoke all on function public.upgrade_apartment() from public;
revoke all on function public.upgrade_apartment() from anon;
drop function if exists public.upgrade_apartment();
