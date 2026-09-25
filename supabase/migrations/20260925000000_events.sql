-- ADR 0005 (docs/decisions/0005-hosted-event-store.md): one append-only
-- table, written directly by the browser with the publishable key. The
-- endpoint is public, so every bound in the ADR's "these bounds are part of
-- the decision" list is enforced here, in the database, not only by the
-- client code in src/lib/tracking-transport.ts — a request that never goes
-- through that code must still be refused.
--
-- Event names, per-event props shapes, and the variant/enum values below are
-- docs/measurement/66-parody-event-contract.md's contract (§3, §4), amended
-- by #67's order_placed handling_instructions/promo_code enums.
--
-- `anon` is created here, guarded, only so this migration is self-contained
-- and testable against a bare Postgres (supabase/migrations/events.test.ts) —
-- a real Supabase project already has it, and the guard makes re-running
-- this against one a no-op for that statement.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end
$$;

create extension if not exists pgcrypto;

create schema if not exists private;

create table public.events (
  id uuid primary key,
  visitor_id uuid not null,
  session_id uuid not null,
  event_name text not null check (event_name in (
    'landing_viewed', 'restaurants_viewed', 'restaurant_opened',
    'cart_viewed', 'checkout_viewed', 'order_placed',
    'tracker_viewed', 'order_abandoned'
  )),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  -- ADR 0005 §1: "props jsonb checked to be an object of at most 1 KB".
  props jsonb not null check (
    jsonb_typeof(props) = 'object' and octet_length(props::text) <= 1024
  ),
  -- No experiment ships this round (event contract §3) — narrower than an
  -- open text column so nothing but null can land here until one does.
  variant text check (variant is null),
  constraint occurred_at_within_window check (
    occurred_at between received_at - interval '1 day' and received_at + interval '5 minutes'
  )
);

-- ADR 0005 §1: "anon gets a column-level insert grant and no select, update
-- or delete grant or policy, so rows are unreadable and unchangeable from
-- the outside."
revoke all on public.events from anon;
grant insert (id, visitor_id, session_id, event_name, occurred_at, props, variant)
  on public.events to anon;

alter table public.events enable row level security;
alter table public.events force row level security;

-- ADR 0005 §2 / event contract §4: each event name's props shape, encoded
-- so it can be the RLS insert policy's WITH CHECK below. `keys` sorted so
-- an exact-match array comparison also catches an extra, unlisted key.
create or replace function public.event_is_valid(event_name text, props jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  keys text[];
begin
  select coalesce(array_agg(k order by k), array[]::text[])
    into keys
  from jsonb_object_keys(props) k;

  if event_name = 'landing_viewed' then
    return keys = array['has_active_order']
      and jsonb_typeof(props->'has_active_order') = 'boolean';

  elsif event_name = 'restaurants_viewed' then
    return keys = array[]::text[];

  elsif event_name = 'restaurant_opened' then
    return keys = array['restaurant_slug']
      and jsonb_typeof(props->'restaurant_slug') = 'string'
      and length(props->>'restaurant_slug') between 1 and 60
      and props->>'restaurant_slug' ~ '^[a-z0-9]+(-[a-z0-9]+)*$';

  elsif event_name = 'cart_viewed' then
    return keys = array['item_count', 'subtotal_cents']
      and props->>'item_count' ~ '^[0-9]+$'
      and (props->>'item_count')::bigint between 0 and 999
      and props->>'subtotal_cents' ~ '^[0-9]+$'
      and (props->>'subtotal_cents')::bigint between 0 and 100000;

  elsif event_name = 'checkout_viewed' then
    return keys = array['item_count', 'subtotal_cents']
      and props->>'item_count' ~ '^[0-9]+$'
      and (props->>'item_count')::bigint between 1 and 999
      and props->>'subtotal_cents' ~ '^[0-9]+$'
      and (props->>'subtotal_cents')::bigint between 1 and 100000;

  elsif event_name = 'order_placed' then
    return keys = array[
        'drop_off_spot', 'handling_instructions', 'item_count', 'order_id',
        'promo_code', 'subtotal_cents', 'tip_percent', 'utensils'
      ]
      and props->>'order_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and props->>'item_count' ~ '^[0-9]+$'
      and (props->>'item_count')::bigint between 1 and 999
      and props->>'subtotal_cents' ~ '^[0-9]+$'
      and (props->>'subtotal_cents')::bigint between 1 and 100000
      and props->>'drop_off_spot' in ('couch', 'wherever_i_am', 'the_void', 'behind_you')
      -- #67's amended contract (issue #68 AC6, moved from #67 AC8(c)):
      and props->>'handling_instructions' in ('guard_it', 'wing_it', 'two_hands', 'surprise_me')
      and jsonb_typeof(props->'utensils') = 'boolean'
      and props->>'tip_percent' ~ '^[0-9]+$'
      and (props->>'tip_percent')::int in (0, 10, 15, 20)
      and props->>'promo_code' in ('dont_drop10', 'still_here', 'clumsy15', 'gotcha');

  elsif event_name = 'tracker_viewed' then
    return keys = array['minutes_since_order', 'order_id', 'view_number']
      and props->>'order_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof(props->'minutes_since_order') = 'number'
      and (props->>'minutes_since_order')::numeric >= 0
      and props->>'view_number' ~ '^[0-9]+$'
      and (props->>'view_number')::bigint >= 1;

  elsif event_name = 'order_abandoned' then
    return keys = array['minutes_since_order', 'order_id', 'view_count']
      and props->>'order_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof(props->'minutes_since_order') = 'number'
      and (props->>'minutes_since_order')::numeric >= 0
      and props->>'view_count' ~ '^[0-9]+$'
      and (props->>'view_count')::bigint >= 1;

  else
    return false;
  end if;
end;
$$;

-- ADR 0005 §2: "the RLS insert policy for anon is
-- with check (public.event_is_valid(event_name, props))".
create policy events_insert_anon on public.events
  for insert
  to anon
  with check (public.event_is_valid(event_name, props));

-- ADR 0005 §4: "60 writes per IP per 5 minutes, keyed on a salted hash of
-- the IP in a non-exposed schema, purged after one hour. No IP reaches
-- events" directly — refused before the row is written, by this trigger.
-- Reads the IP from the `request.headers` GUC PostgREST sets on every
-- request (a JSON object of the incoming headers — a GUC name cannot
-- itself contain the hyphens an HTTP header name does, so PostgREST packs
-- all of them into this one JSON-valued setting rather than one GUC per
-- header). A session with no such header (this migration applied by hand,
-- or a test that never sets it) is not rate-limited, since there is no IP
-- to key on.
create table private.write_log (
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index write_log_ip_hash_created_at_idx on private.write_log (ip_hash, created_at);

-- security definer: anon has no grant on the private schema at all (the
-- point of putting write_log there), so this must run as the function's
-- owner rather than the inserting role. search_path is pinned so a
-- same-named object earlier on some other role's path can't hijack it.
create or replace function public.enforce_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  headers jsonb;
  client_ip text;
  v_ip_hash text;
  recent_count int;
begin
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  client_ip := nullif(headers ->> 'x-forwarded-for', '');

  if client_ip is not null then
    v_ip_hash := encode(
      digest(client_ip || coalesce(current_setting('app.rate_limit_salt', true), ''), 'sha256'),
      'hex'
    );

    delete from private.write_log where created_at < now() - interval '1 hour';

    select count(*) into recent_count
    from private.write_log
    where ip_hash = v_ip_hash and created_at > now() - interval '5 minutes';

    if recent_count >= 60 then
      raise exception 'rate limit exceeded' using errcode = 'P0001';
    end if;

    insert into private.write_log (ip_hash) values (v_ip_hash);
  end if;

  return new;
end;
$$;

create trigger events_rate_limit
  before insert on public.events
  for each row
  execute function public.enforce_write_rate_limit();
