alter table public.player_states
drop constraint if exists player_states_last_location_check;

alter table public.player_states
add constraint player_states_last_location_check check (
  last_location in (
    'apartment', 'chelsea', 'central-park', 'east-village-les',
    'fidi', 'midtown', 'west-village'
  )
);
