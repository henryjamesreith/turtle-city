alter table public.profiles
add column turtle_tag text;

create unique index profiles_turtle_tag_unique_idx
on public.profiles (lower(turtle_tag))
where turtle_tag is not null;

create or replace function public.assign_turtle_tag()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  name_slug text;
begin
  if new.turtle_name is not null and new.turtle_tag is null then
    name_slug := trim(
      both '-' from lower(
        regexp_replace(new.turtle_name, '[^a-zA-Z0-9]+', '-', 'g')
      )
    );

    if name_slug = '' then
      name_slug := 'turtle';
    end if;

    new.turtle_tag := left(name_slug, 20)
      || '-'
      || replace(new.user_id::text, '-', '');
  end if;

  return new;
end;
$$;

create trigger profiles_assign_turtle_tag
before insert or update of turtle_name on public.profiles
for each row execute function public.assign_turtle_tag();

update public.profiles
set turtle_name = turtle_name
where turtle_name is not null
and turtle_tag is null;
