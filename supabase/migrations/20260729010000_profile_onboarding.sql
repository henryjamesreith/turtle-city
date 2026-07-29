alter table public.profiles
add column personality text,
add column onboarding_completed_at timestamptz;

alter table public.profiles
add constraint profiles_personality_length_check check (
  personality is null
  or char_length(personality) <= 240
);
