alter table public.item_catalog
drop constraint if exists item_catalog_category_check;

alter table public.item_catalog
add constraint item_catalog_category_check check (
  category in ('clothing', 'turtle-skin', 'furniture', 'apartment-upgrade', 'transport')
);

insert into public.item_catalog (item_key, name, category, description, metadata)
values (
  'chelsea-skateboard',
  'Shell & Roll Starter Board',
  'transport',
  'A free first skateboard from the Chelsea shop.',
  '{"speed": 12, "color": "sunset-yellow"}'::jsonb
)
on conflict (item_key) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  metadata = excluded.metadata,
  is_active = true;

create policy "Players can claim the free Chelsea skateboard"
on public.inventory_items for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and item_key = 'chelsea-skateboard'
  and quantity = 1
);

grant insert on public.inventory_items to authenticated;
