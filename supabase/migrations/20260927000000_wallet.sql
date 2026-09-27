-- #145: additive migration for the play-money wallet — ADR 0008
-- (docs/decisions/0008-play-money-wallet-and-sign-in.md), objective #136.
-- Strictly additive per house rules: this file only creates new relations
-- and functions; 20260925000000_events.sql and
-- 20260926000000_two_city_event_contract.sql are untouched, and the
-- `events` table's grants are unchanged.
--
-- Assumes `auth.users`, `auth.uid()` and the `authenticated` role exist, as
-- they do on Supabase. Never creates or replaces any of the three — the
-- test suite stubs them first (wallet.migration.test.ts), and a
-- `create or replace function auth.uid()` here would overwrite Supabase's
-- own function on the live project. `private` is the schema
-- 20260925000000_events.sql already created.
--
-- All amounts are integer minor units: cents for USD, whole đồng for VND
-- (src/lib/money.ts).

create table public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  usd_minor bigint not null check (usd_minor >= 0),
  vnd_minor bigint not null check (vnd_minor >= 0),
  created_at timestamptz not null default now()
);

-- RLS is enabled but not forced, so the security-definer functions below
-- (owned by the table owner) can still write it — deliberately different
-- from `events`, which is force-RLS'd because nothing writes it but anon's
-- own insert.
alter table public.wallets enable row level security;

create policy wallets_select_own on public.wallets
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No client role can insert, update or delete a wallet directly. Only the
-- functions below change it.
revoke all on public.wallets from anon, authenticated;
grant select on public.wallets to authenticated;

-- The key is what makes "one claim per window" a database fact.
create table private.wallet_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, window_start)
);

-- The key is the idempotency key for wallet_debit.
create table private.wallet_debits (
  order_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  currency text not null check (currency in ('USD', 'VND')),
  amount_minor bigint not null check (amount_minor > 0),
  debited_at timestamptz not null default now()
);

-- Private helpers. No grant to anon or authenticated: the Data API doesn't
-- expose the `private` schema at all, and the default PUBLIC execute grant
-- Postgres gives every new function is revoked below on each one, so even a
-- direct connection as anon/authenticated is refused.

-- The preload happens exactly once per account, on whichever wallet call
-- comes first. There is no trigger on auth.users (rejected alternative,
-- ADR 0008): a failing trigger fails the sign-up itself.
create or replace function private.ensure_wallet(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.wallets (user_id, usd_minor, vnd_minor)
  values (p_user_id, 3000, 750000)
  on conflict (user_id) do nothing;
end;
$$;

revoke execute on function private.ensure_wallet(uuid) from public;

-- D8's floor, hard-coded. SF's cheapest item is 300 and its lowest delivery
-- fee is 99 (src/lib/restaurants.ts); HCMC's are 10,000 and 10,000. The
-- floor is safe for legitimate orders today: the smallest real totals are
-- 450 cents in SF and 30,000 ₫ in HCMC.
create or replace function private.debit_floor_minor(p_currency text)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case p_currency
    when 'USD' then 399::bigint
    when 'VND' then 20000::bigint
  end;
$$;

revoke execute on function private.debit_floor_minor(text) from public;

-- The windows are local America/Los_Angeles time: [07:00, 15:00),
-- [15:00, 23:00) and [23:00, 07:00), each half-open. `date_trunc('day', ...)`
-- gives local midnight as a naive timestamp; subtracting one hour from it is
-- yesterday's 23:00, which is what makes the "before 07:00" branch below
-- work without a separate day-rollback case. Converting a naive local
-- wall-clock timestamp back with `at time zone` looks up that zone's offset
-- for that specific local time, so the DST transition is handled by
-- Postgres's own zoneinfo rather than by any date arithmetic here — this
-- function must stay `stable`, not `immutable`, because it depends on
-- `America/Los_Angeles`'s zoneinfo rules.
create or replace function private.drip_window_start(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (
    date_trunc('day', p_at at time zone 'America/Los_Angeles')
    + case
        when (p_at at time zone 'America/Los_Angeles')::time >= time '23:00' then interval '23 hours'
        when (p_at at time zone 'America/Los_Angeles')::time >= time '15:00' then interval '15 hours'
        when (p_at at time zone 'America/Los_Angeles')::time >= time '07:00' then interval '7 hours'
        else interval '-1 hours'
      end
  ) at time zone 'America/Los_Angeles';
$$;

revoke execute on function private.drip_window_start(timestamptz) from public;

-- Adds 8 nominal local wall-clock hours to the current window's start,
-- then converts back the same way `drip_window_start` does — so a DST
-- transition inside those 8 local hours changes the real elapsed time
-- (7 or 9 hours) without changing the wall-clock boundary.
create or replace function private.drip_next_window_start(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (
    (private.drip_window_start(p_at) at time zone 'America/Los_Angeles') + interval '8 hours'
  ) at time zone 'America/Los_Angeles';
$$;

revoke execute on function private.drip_next_window_start(timestamptz) from public;

-- The internal, clock-taking engine behind wallet_claim_drip. No client
-- role can execute this — the client-callable function below always passes
-- it now(). Tests exercise drip windows (including the DST cases) by
-- calling this directly as the table owner, which bypasses grants entirely.
create or replace function private.wallet_claim_drip_at(p_user_id uuid, p_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz := private.drip_window_start(p_at);
  v_claimed boolean := false;
  v_usd_minor bigint;
  v_vnd_minor bigint;
begin
  perform private.ensure_wallet(p_user_id);

  insert into private.wallet_claims (user_id, window_start)
  values (p_user_id, v_window_start)
  on conflict (user_id, window_start) do nothing;

  if found then
    v_claimed := true;
    update public.wallets
      set usd_minor = usd_minor + 500,
          vnd_minor = vnd_minor + 100000
      where user_id = p_user_id;
  end if;

  select w.usd_minor, w.vnd_minor into v_usd_minor, v_vnd_minor
  from public.wallets w
  where w.user_id = p_user_id;

  return jsonb_build_object(
    'claimed', v_claimed,
    'usd_minor', v_usd_minor,
    'vnd_minor', v_vnd_minor,
    'window_start', v_window_start,
    'next_window_start', private.drip_next_window_start(p_at)
  );
end;
$$;

revoke execute on function private.wallet_claim_drip_at(uuid, timestamptz) from public;

-- Public wallet functions. Every one is security definer (wallet_ready is
-- the sole exception — it reads nothing), set search_path = '' with every
-- relation schema-qualified, stripped of the default grants Supabase and
-- Postgres both hand new public functions to PUBLIC by default, and
-- granted back only to the role named here. Each runs as one transaction
-- per call (one PostgREST request).

create or replace function public.wallet_ready()
returns boolean
language sql
stable
set search_path = ''
as $$
  select true;
$$;

revoke all on function public.wallet_ready() from public;
grant execute on function public.wallet_ready() to anon, authenticated;

create or replace function public.wallet_get()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_now timestamptz := now();
  v_usd_minor bigint;
  v_vnd_minor bigint;
  v_claimed boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform private.ensure_wallet(v_user_id);

  select w.usd_minor, w.vnd_minor into v_usd_minor, v_vnd_minor
  from public.wallets w
  where w.user_id = v_user_id;

  select exists (
    select 1 from private.wallet_claims c
    where c.user_id = v_user_id and c.window_start = private.drip_window_start(v_now)
  ) into v_claimed;

  return jsonb_build_object(
    'usd_minor', v_usd_minor,
    'vnd_minor', v_vnd_minor,
    'window_start', private.drip_window_start(v_now),
    'next_window_start', private.drip_next_window_start(v_now),
    'claimed_this_window', v_claimed
  );
end;
$$;

revoke all on function public.wallet_get() from public;
grant execute on function public.wallet_get() to authenticated;

create or replace function public.wallet_claim_drip()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return private.wallet_claim_drip_at(v_user_id, now());
end;
$$;

revoke all on function public.wallet_claim_drip() from public;
grant execute on function public.wallet_claim_drip() to authenticated;

-- wallet_debit checks, in order: authenticated and not anonymous; currency
-- is USD or VND; amount is positive; amount clears the floor; then the
-- order_id idempotency key — a hit belonging to the caller returns
-- already_debited unchanged, a hit belonging to someone else raises. Only
-- then is the wallet locked and the balance checked, so a JSON-shaped
-- browser amount can never mint money, double-charge one order, or read or
-- change another user's wallet (ADR 0008, "fully guarded" list).
create or replace function public.wallet_debit(p_order_id uuid, p_currency text, p_amount_minor bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_existing private.wallet_debits%rowtype;
  v_usd_minor bigint;
  v_vnd_minor bigint;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_currency not in ('USD', 'VND') then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  if p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  if p_amount_minor < private.debit_floor_minor(p_currency) then
    raise exception 'below_floor' using errcode = '22023';
  end if;

  select * into v_existing from private.wallet_debits where order_id = p_order_id;

  if found then
    if v_existing.user_id <> v_user_id then
      raise exception 'order_id_conflict' using errcode = '23505';
    end if;

    perform private.ensure_wallet(v_user_id);

    select w.usd_minor, w.vnd_minor into v_usd_minor, v_vnd_minor
    from public.wallets w
    where w.user_id = v_user_id;

    return jsonb_build_object(
      'status', 'already_debited',
      'usd_minor', v_usd_minor,
      'vnd_minor', v_vnd_minor,
      'next_window_start', private.drip_next_window_start(now())
    );
  end if;

  perform private.ensure_wallet(v_user_id);

  select w.usd_minor, w.vnd_minor into v_usd_minor, v_vnd_minor
  from public.wallets w
  where w.user_id = v_user_id
  for update;

  if (p_currency = 'USD' and v_usd_minor < p_amount_minor)
    or (p_currency = 'VND' and v_vnd_minor < p_amount_minor) then
    return jsonb_build_object(
      'status', 'insufficient',
      'usd_minor', v_usd_minor,
      'vnd_minor', v_vnd_minor,
      'next_window_start', private.drip_next_window_start(now())
    );
  end if;

  if p_currency = 'USD' then
    update public.wallets set usd_minor = usd_minor - p_amount_minor where user_id = v_user_id;
    v_usd_minor := v_usd_minor - p_amount_minor;
  else
    update public.wallets set vnd_minor = vnd_minor - p_amount_minor where user_id = v_user_id;
    v_vnd_minor := v_vnd_minor - p_amount_minor;
  end if;

  insert into private.wallet_debits (order_id, user_id, currency, amount_minor)
  values (p_order_id, v_user_id, p_currency, p_amount_minor);

  return jsonb_build_object(
    'status', 'debited',
    'usd_minor', v_usd_minor,
    'vnd_minor', v_vnd_minor,
    'next_window_start', private.drip_next_window_start(now())
  );
end;
$$;

revoke all on function public.wallet_debit(uuid, text, bigint) from public;
grant execute on function public.wallet_debit(uuid, text, bigint) to authenticated;
