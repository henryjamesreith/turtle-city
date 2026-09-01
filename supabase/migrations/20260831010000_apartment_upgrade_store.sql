alter table public.wallets alter column shells set default 300;
update public.wallets set shells = 300 where shells = 0;

insert into public.item_catalog (item_key, name, category, description, metadata)
values
  ('apartment-warm-lights', 'Warm Lighting', 'apartment-upgrade', 'Replace the bare bulb with warm apartment lighting.', '{"price":75}'::jsonb),
  ('apartment-fresh-walls', 'Fresh Walls', 'apartment-upgrade', 'Patch and repaint the apartment walls.', '{"price":125}'::jsonb),
  ('apartment-comfy-bed', 'Comfy Bed', 'apartment-upgrade', 'Upgrade the starter mattress and bedding.', '{"price":175}'::jsonb)
on conflict (item_key) do update set name = excluded.name, description = excluded.description, metadata = excluded.metadata, is_active = true;

create or replace function public.purchase_apartment_upgrade(requested_item_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  price bigint;
  balance bigint;
  next_upgrades jsonb;
begin
  if player_id is null then raise exception 'Sign in to make purchases.' using errcode = '28000'; end if;
  select (metadata->>'price')::bigint into price from public.item_catalog
    where item_key = requested_item_key and category = 'apartment-upgrade' and is_active;
  if price is null then raise exception 'That upgrade is unavailable.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.inventory_items where user_id = player_id and item_key = requested_item_key) then
    raise exception 'You already own that upgrade.' using errcode = '23505';
  end if;
  update public.wallets set shells = shells - price where user_id = player_id and shells >= price returning shells into balance;
  if balance is null then raise exception 'Not enough Shells.' using errcode = 'P0001'; end if;
  insert into public.inventory_items (user_id, item_key, equipped) values (player_id, requested_item_key, true);
  update public.apartments set
    upgrades = coalesce(upgrades, '{}'::jsonb) || jsonb_build_object(requested_item_key, true),
    tier = least(10, tier + 1)
  where user_id = player_id returning upgrades into next_upgrades;
  return jsonb_build_object('shells', balance, 'upgrades', next_upgrades);
end;
$$;

revoke all on function public.purchase_apartment_upgrade(text) from public;
revoke all on function public.purchase_apartment_upgrade(text) from anon;
grant execute on function public.purchase_apartment_upgrade(text) to authenticated;
