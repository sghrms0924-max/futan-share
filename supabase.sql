create table if not exists household_states (
  household_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table household_states enable row level security;

drop policy if exists "allow household app read" on household_states;
drop policy if exists "allow household app insert" on household_states;
drop policy if exists "allow household app update" on household_states;

create or replace function get_household_state(p_household_id text)
returns table(data jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select household_states.data, household_states.updated_at
  from household_states
  where household_states.household_id = p_household_id
  limit 1;
$$;

create or replace function save_household_state(
  p_household_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into household_states (household_id, data, updated_at)
  values (p_household_id, p_data, p_updated_at)
  on conflict (household_id) do update
  set data = excluded.data,
      updated_at = excluded.updated_at;
$$;

grant execute on function get_household_state(text) to anon;
grant execute on function save_household_state(text, jsonb, timestamptz) to anon;
