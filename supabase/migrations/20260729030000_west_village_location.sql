alter table public.player_states
drop constraint player_states_last_location_check;

alter table public.player_states
add constraint player_states_last_location_check check (
  last_location in (
    'apartment',
    'chelsea',
    'central-park',
    'west-village'
  )
);
