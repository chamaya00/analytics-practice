-- #164: additive migration for tipping a driver from the wallet — ADR 0008
-- amendment (docs/decisions/0008-play-money-wallet-and-sign-in.md), objective
-- #135, presets from #162 (docs/design/162-rating-win-tips-rewards-vip.md).
-- Strictly additive per house rules: this file only creates new relations
-- and functions; 20260925000000_events.sql, 20260926000000_two_city_event_
-- contract.sql and 20260927000000_wallet.sql are untouched, and none of
-- their grants change.
--
-- A tip cannot reuse wallet_debit: wallet_debits is keyed by order_id, so a
-- tip on an already-debited order would return already_debited and charge
-- nothing, and wallet_debit's floor (399 cents / 20.000 VND) would reject
-- most plausible tips. Tips are their own idempotency key, their own table,
-- and their own fixed presets the server enforces exactly (D14, #162).
--
-- All amounts are integer minor units: cents for USD, whole đồng for VND
-- (src/lib/money.ts).

-- The key is the idempotency key for wallet_tip: one tip per order. The
-- foreign key to wallet_debits.order_id is D14 as a database fact — a tip
-- cannot exist for an order that was never paid from the wallet.
create table private.wallet_tips (
  order_id uuid primary key references private.wallet_debits (order_id),
  user_id uuid not null references auth.users (id) on delete cascade,
  currency text not null check (currency in ('USD', 'VND')),
  amount_minor bigint not null check (amount_minor > 0),
  tipped_at timestamptz not null default now()
);

-- private has no USAGE grant to anon or authenticated (ADR 0008, "private is
-- the schema ADR 0005's migration already created... anon and authenticated
-- have no usage on it") — a new table in it needs no explicit revoke, the
-- same as wallet_debits above. Stated as a check below, not just an
-- assumption.

-- The tip presets, hard-coded exactly as the driver accepted them on #164:
-- USD 100/200/300 cents, VND 10000/20000/30000 đồng. Any other amount is
-- refused. immutable and takes no time argument, so it is safe even if a
-- future change ever exposed it.
create or replace function private.is_valid_tip_amount(p_currency text, p_amount_minor bigint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_currency
    when 'USD' then p_amount_minor in (100, 200, 300)
    when 'VND' then p_amount_minor in (10000, 20000, 30000)
    else false
  end;
$$;

revoke execute on function private.is_valid_tip_amount(text, bigint) from public;

-- public.wallet_tip: tips the order's own driver, once per order_id, for
-- exactly one of the caller's currency's presets. security definer, fixed
-- search_path, stripped of PUBLIC's default execute grant, granted only to
-- authenticated (ADR 0008's function template, "Functions").
--
-- Checks, in order:
-- 1. auth.uid() is not null, and the caller is not an anonymous-auth user.
-- 2. order_id has a wallet_debits row at all, and it belongs to the caller
--    (D14) — refused otherwise, so tipping is only ever the caller's own
--    paid order, never an unpaid or someone else's order.
-- 3. The currency comes from that debit row, never from the caller, and the
--    amount is one of that currency's presets — anything else is refused.
-- 4. order_id idempotency: an existing tip returns already_tipped with the
--    original amount unchanged, rather than raising, so a retrying client
--    gets a normal answer instead of an error to unpack.
-- 5. Only then is the wallet locked and the balance checked: insufficient
--    leaves it unchanged, otherwise the tip is debited and recorded in the
--    same transaction.
create or replace function public.wallet_tip(p_order_id uuid, p_amount_minor bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_debit private.wallet_debits%rowtype;
  v_existing_tip private.wallet_tips%rowtype;
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

  select * into v_debit from private.wallet_debits where order_id = p_order_id;

  if not found then
    raise exception 'order_not_debited' using errcode = '22023';
  end if;

  if v_debit.user_id <> v_user_id then
    raise exception 'order_not_debited' using errcode = '22023';
  end if;

  if not private.is_valid_tip_amount(v_debit.currency, p_amount_minor) then
    raise exception 'invalid_tip_amount' using errcode = '22023';
  end if;

  select * into v_existing_tip from private.wallet_tips where order_id = p_order_id;

  if found then
    perform private.ensure_wallet(v_user_id);

    select w.usd_minor, w.vnd_minor into v_usd_minor, v_vnd_minor
    from public.wallets w
    where w.user_id = v_user_id;

    return jsonb_build_object(
      'status', 'already_tipped',
      'amount_minor', v_existing_tip.amount_minor,
      'currency', v_existing_tip.currency,
      'usd_minor', v_usd_minor,
      'vnd_minor', v_vnd_minor
    );
  end if;

  perform private.ensure_wallet(v_user_id);

  select w.usd_minor, w.vnd_minor into v_usd_minor, v_vnd_minor
  from public.wallets w
  where w.user_id = v_user_id
  for update;

  if (v_debit.currency = 'USD' and v_usd_minor < p_amount_minor)
    or (v_debit.currency = 'VND' and v_vnd_minor < p_amount_minor) then
    return jsonb_build_object(
      'status', 'insufficient',
      'usd_minor', v_usd_minor,
      'vnd_minor', v_vnd_minor
    );
  end if;

  if v_debit.currency = 'USD' then
    update public.wallets set usd_minor = usd_minor - p_amount_minor where user_id = v_user_id;
    v_usd_minor := v_usd_minor - p_amount_minor;
  else
    update public.wallets set vnd_minor = vnd_minor - p_amount_minor where user_id = v_user_id;
    v_vnd_minor := v_vnd_minor - p_amount_minor;
  end if;

  insert into private.wallet_tips (order_id, user_id, currency, amount_minor)
  values (p_order_id, v_user_id, v_debit.currency, p_amount_minor);

  return jsonb_build_object(
    'status', 'tipped',
    'amount_minor', p_amount_minor,
    'currency', v_debit.currency,
    'usd_minor', v_usd_minor,
    'vnd_minor', v_vnd_minor
  );
end;
$$;

revoke all on function public.wallet_tip(uuid, bigint) from public;
grant execute on function public.wallet_tip(uuid, bigint) to authenticated;
