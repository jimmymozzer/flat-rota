-- Flat rota database setup. Safe to run more than once.
-- Replace <YOUR_FLAT_CODE> below (keep the quote marks).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.rota_settings (
  id int primary key default 1 check (id = 1),
  code_hash text not null,
  names text[] not null default array['Jimmy','Flatmate']
);

create table if not exists public.rota_ticks (
  key text primary key check (length(key) <= 64),
  by smallint not null check (by in (0, 1)),
  at timestamptz not null default now()
);

alter table public.rota_settings enable row level security;
alter table public.rota_ticks enable row level security;

insert into public.rota_settings (id, code_hash)
values (1, extensions.crypt('<YOUR_FLAT_CODE>', extensions.gen_salt('bf')))
on conflict (id) do update set code_hash = excluded.code_hash;

create or replace function public.rota_ok(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from rota_settings
    where id = 1 and code_hash = crypt(p_code, code_hash)
  );
$$;

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
    )
  );
end
$$;

create or replace function public.rota_tick(p_code text, p_key text, p_by int)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not rota_ok(p_code) then
    raise exception 'wrong flat code';
  end if;
  if p_by is null then
    delete from rota_ticks where key = p_key;
  else
    insert into rota_ticks (key, by, at) values (p_key, p_by, now())
    on conflict (key) do update set by = excluded.by, at = excluded.at;
  end if;
end
$$;

create or replace function public.rota_names(p_code text, p_names text[])
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not rota_ok(p_code) then
    raise exception 'wrong flat code';
  end if;
  if array_length(p_names, 1) <> 2
     or length(p_names[1]) not between 1 and 20
     or length(p_names[2]) not between 1 and 20 then
    raise exception 'bad names';
  end if;
  update rota_settings set names = p_names where id = 1;
end
$$;
