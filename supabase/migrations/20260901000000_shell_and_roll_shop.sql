insert into public.item_catalog (item_key, name, category, description, metadata)
values
  ('shell-and-roll-helmet', 'Street-Safe Helmet', 'clothing', 'A forest-green hard-shell helmet from Shell & Roll.', '{"price":60,"color":"forest-green"}'::jsonb),
  ('shell-and-roll-deck', 'Night Line Deck', 'transport', 'A midnight-blue skateboard deck with a subway stripe.', '{"price":140,"color":"midnight-blue"}'::jsonb)
on conflict (item_key) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  metadata = excluded.metadata,
  is_active = true;

create or replace function public.purchase_shop_item(requested_item_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  price bigint;
  balance bigint;
begin
  if player_id is null then raise exception 'Sign in to shop.' using errcode = '28000'; end if;

  select (metadata->>'price')::bigint into price
  from public.item_catalog
  where item_key = requested_item_key
    and item_key in ('shell-and-roll-helmet', 'shell-and-roll-deck')
    and is_active;

  if price is null then raise exception 'That item is not for sale.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.inventory_items where user_id = player_id and item_key = requested_item_key) then
    raise exception 'You already own that item.' using errcode = '23505';
  end if;

  update public.wallets
  set shells = shells - price
  where user_id = player_id and shells >= price
  returning shells into balance;

  if balance is null then raise exception 'Not enough Shells.' using errcode = 'P0001'; end if;

  insert into public.inventory_items (user_id, item_key, equipped, metadata)
  values (player_id, requested_item_key, true, jsonb_build_object('source', 'shell-and-roll'));

  return jsonb_build_object('shells', balance, 'item_key', requested_item_key);
end;
$$;

revoke all on function public.purchase_shop_item(text) from public;
revoke all on function public.purchase_shop_item(text) from anon;
grant execute on function public.purchase_shop_item(text) to authenticated;
