create or replace function public.set_equipped_gear(
  requested_item_key text,
  requested_equipped boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
begin
  if player_id is null then raise exception 'Sign in to equip gear.' using errcode = '28000'; end if;
  if requested_item_key not in ('chelsea-skateboard', 'shell-and-roll-deck', 'shell-and-roll-helmet') then
    raise exception 'That item cannot be equipped here.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.inventory_items
    where user_id = player_id and item_key = requested_item_key
  ) then raise exception 'You do not own that item.' using errcode = '42501'; end if;

  if requested_equipped and requested_item_key in ('chelsea-skateboard', 'shell-and-roll-deck') then
    update public.inventory_items set equipped = false
    where user_id = player_id and item_key in ('chelsea-skateboard', 'shell-and-roll-deck');
  end if;

  update public.inventory_items set equipped = requested_equipped
  where user_id = player_id and item_key = requested_item_key;

  return coalesce((
    select jsonb_agg(item_key order by item_key)
    from public.inventory_items
    where user_id = player_id and equipped
  ), '[]'::jsonb);
end;
$$;

-- Older purchases could mark both decks equipped. Prefer the purchased Night
-- Line deck until the player makes another selection in Settings.
update public.inventory_items starter
set equipped = false
where starter.item_key = 'chelsea-skateboard'
  and exists (
    select 1 from public.inventory_items night
    where night.user_id = starter.user_id
      and night.item_key = 'shell-and-roll-deck'
      and night.equipped
  );

revoke all on function public.set_equipped_gear(text, boolean) from public;
revoke all on function public.set_equipped_gear(text, boolean) from anon;
grant execute on function public.set_equipped_gear(text, boolean) to authenticated;
