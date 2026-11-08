-- Flat rota: one-off jobs. Safe to run more than once. Nothing to replace in this one.

create table if not exists public.rota_custom (
  id text primary key check (length(id) between 1 and 40),
  week text not null check (week ~ '^\d{4}-\d{2}-\d{2}$'),
  name text not null check (length(name) between 1 and 60),
  owner smallint check (owner in (0, 1)),          -- null means either of you
  minutes int not null check (minutes between 1 and 600),
  created_at timestamptz not null default now()
);
alter table public.rota_custom enable row level security;

-- Same as before, plus the list of one-off jobs.
create or replace function public.rota_state(p_code text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not rota_ok(p_code) then
    raise exception 'wrong flat code';
  end if;
  return json_build_object(
    'names', (select names from rota_settings where id = 1),
    'ticks', coalesce(
      (select json_object_agg(key, json_build_object('by', by, 'at', at)) from rota_ticks),
      '{}'::json
    ),
    'custom', coalesce(
      (select json_agg(json_build_object(
          'id', id, 'week', week, 'name', name, 'owner', owner, 'minutes', minutes)
        order by created_at)
       from rota_custom),
      '[]'::json
    )
  );
end
$$;

create or replace function public.rota_custom_save(
  p_code text, p_id text, p_week text, p_name text, p_owner int, p_minutes int)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not rota_ok(p_code) then
    raise exception 'wrong flat code';
  end if;
  insert into rota_custom (id, week, name, owner, minutes)
  values (p_id, p_week, p_name, p_owner, p_minutes)
  on conflict (id) do update
    set name = excluded.name, owner = excluded.owner, minutes = excluded.minutes;
end
$$;

create or replace function public.rota_custom_delete(p_code text, p_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not rota_ok(p_code) then
    raise exception 'wrong flat code';
  end if;
  delete from rota_custom where id = p_id;
  -- also clear its tick and any logged time
  delete from rota_ticks where position(('_c-' || p_id) in key) > 0;
end
$$;
