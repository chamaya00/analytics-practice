-- #283 (parent #281): a global cost guard on public.events. Additive per house
-- rules (ADR 0005): no earlier migration is edited, and no row of
-- public.events is ever deleted. A `before insert` trigger refuses the insert
-- when either
--   - 20,000 or more events were accepted in the trailing 60 minutes across
--     all clients ('global event ceiling exceeded'), or
--   - pg_total_relation_size('public.events') is over 300 MB
--     ('event storage ceiling exceeded').
-- Both messages differ from the per-IP limit's 'rate limit exceeded'. Both
-- numbers are the owner's (O1 on #282).
--
-- Each number is defined once, in the one-row private.event_ceilings table;
-- raising either later is a one-line `update private.event_ceilings set ...`
-- migration.
--
-- Cheap on every insert: received_at has no index and private.write_log only
-- records requests that carry an IP header, so neither can be counted as-is.
-- Accepted inserts are counted in per-minute buckets instead
-- (private.event_write_buckets), pruned the same way write_log is.
--
-- Same hardening as public.enforce_write_rate_limit(): security definer and a
-- pinned search_path. anon and authenticated gain no grant on `private`.

-- `authenticated` is created here, guarded, only so this migration is
-- self-contained against a bare Postgres (the revokes at the bottom name it),
-- as 20260925000000_events.sql does for `anon`. A real Supabase project
-- already has it, so this is a no-op there.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

create table private.event_ceilings (
  id boolean primary key default true,
  hourly_ceiling bigint not null check (hourly_ceiling > 0),
  storage_ceiling_bytes bigint not null check (storage_ceiling_bytes > 0),
  constraint event_ceilings_single_row check (id)
);

insert into private.event_ceilings (hourly_ceiling, storage_ceiling_bytes)
values (20000, 314572800);

create table private.event_write_buckets (
  bucket timestamptz primary key,
  n bigint not null
);

create or replace function public.enforce_event_ceilings()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_hourly bigint;
  v_storage bigint;
  v_recent bigint;
begin
  select hourly_ceiling, storage_ceiling_bytes into v_hourly, v_storage
  from private.event_ceilings;

  delete from private.event_write_buckets where bucket < now() - interval '2 hours';

  select coalesce(sum(n), 0) into v_recent
  from private.event_write_buckets
  where bucket >= date_trunc('minute', now() - interval '60 minutes');

  if v_recent >= v_hourly then
    raise exception 'global event ceiling exceeded' using errcode = 'P0001';
  end if;

  if pg_total_relation_size('public.events') > v_storage then
    raise exception 'event storage ceiling exceeded' using errcode = 'P0001';
  end if;

  insert into private.event_write_buckets (bucket, n)
  values (date_trunc('minute', now()), 1)
  on conflict (bucket) do update set n = private.event_write_buckets.n + 1;

  return new;
end;
$$;

-- Sorts after events_rate_limit, so a client over its own limit still sees
-- 'rate limit exceeded' and is not counted here.
create trigger events_write_ceilings
  before insert on public.events
  for each row
  execute function public.enforce_event_ceilings();

create or replace function public.event_ceiling_headroom()
returns table (
  accepted_last_hour bigint,
  hourly_ceiling bigint,
  events_total_bytes bigint,
  storage_ceiling_bytes bigint
)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select
    (select coalesce(sum(b.n), 0)::bigint from private.event_write_buckets b
      where b.bucket >= date_trunc('minute', now() - interval '60 minutes')),
    c.hourly_ceiling,
    pg_total_relation_size('public.events'),
    c.storage_ceiling_bytes
  from private.event_ceilings c;
$$;

-- Supabase grants execute on new functions to anon and authenticated by
-- default; the owner reads headroom from the SQL editor, nobody else.
revoke all on function public.enforce_event_ceilings() from public, anon, authenticated;
revoke all on function public.event_ceiling_headroom() from public, anon, authenticated;
