-- #85: additive migration for the revised event contract
-- (docs/measurement/81-two-city-event-contract.md), amending ADR 0005 per
-- ADR 0007 (docs/decisions/0007-two-city-event-contract.md). Strictly
-- additive per house rules and the contract's own "AC7": this file only
-- ALTERs what 20260925000000_events.sql created and replaces
-- `event_is_valid`; that file itself is untouched.
--
-- `event_name`'s CHECK is replaced, not widened: the old parody-only names
-- (`landing_viewed`, `restaurants_viewed`, `order_abandoned`) are retired
-- outright (contract §1, §6) and must no longer validate a *new* insert.
-- Dropping and re-adding that CHECK is what makes an old name fail again,
-- but a plain `add constraint` would also validate it against every row
-- already in the table — on a live project that has been running #66's
-- funnel, that would fail the migration outright on its own historical
-- data. `not valid` skips that backfill scan while still enforcing the
-- new list on every row inserted from here on (Postgres: a `not valid`
-- check "will still be enforced against subsequent inserts or updates"),
-- which is exactly the contract's "existing historical rows already in
-- events are untouched either way" (§"AC7").
alter table public.events
  drop constraint events_event_name_check;

alter table public.events
  add constraint events_event_name_check check (event_name in (
    'location_selected', 'home_viewed', 'restaurant_opened', 'cart_viewed',
    'checkout_viewed', 'flash_sheet_shown', 'flash_sheet_closed',
    'order_placed', 'tracker_viewed', 'order_delivered', 'rating_submitted'
  )) not valid;

-- Contract §2: one shared per-currency bound, reused by every
-- `amount_minor` prop below except `flash_sheet_shown`'s, which is bounded
-- to a narrower, fixed drawn range instead (§7) — pulled out once rather
-- than repeated across cart/checkout/order's subtotal and saved amount,
-- since it's the same range check every time.
create or replace function public.amount_minor_in_bounds(
  props jsonb, field text, currency text, allow_zero boolean
)
returns boolean
language plpgsql
immutable
as $$
declare
  raw text;
  hi bigint;
  lo bigint;
begin
  raw := props ->> field;
  if raw is null or raw !~ '^[0-9]+$' then
    return false;
  end if;
  if currency = 'USD' then
    hi := 100000;
  elsif currency = 'VND' then
    hi := 5000000;
  else
    return false;
  end if;
  lo := case when allow_zero then 0 else 1 end;
  return raw::bigint between lo and hi;
end;
$$;

-- Event contract #81 §7: every accepted event name and its props shape,
-- replacing #66's version (docs/measurement/66-parody-event-contract.md,
-- now superseded in full). Retired names simply aren't listed below, so
-- they fall through to the `else return false` branch, same as any other
-- unrecognised name.
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

  if event_name = 'location_selected' then
    return keys = array['city', 'is_switch']
      and props->>'city' in ('sf', 'hcmc')
      and jsonb_typeof(props->'is_switch') = 'boolean';

  elsif event_name = 'home_viewed' then
    return keys = array['city']
      and props->>'city' in ('sf', 'hcmc');

  elsif event_name = 'restaurant_opened' then
    return keys = array['city', 'restaurant_slug']
      and props->>'city' in ('sf', 'hcmc')
      and jsonb_typeof(props->'restaurant_slug') = 'string'
      and length(props->>'restaurant_slug') between 1 and 60
      and props->>'restaurant_slug' ~ '^[a-z0-9]+(-[a-z0-9]+)*$';

  elsif event_name = 'cart_viewed' then
    return keys = array['amount_minor', 'currency', 'item_count']
      and props->>'currency' in ('USD', 'VND')
      and props->>'item_count' ~ '^[0-9]+$'
      and (props->>'item_count')::bigint between 0 and 999
      and public.amount_minor_in_bounds(props, 'amount_minor', props->>'currency', true);

  elsif event_name = 'checkout_viewed' then
    return keys = array['amount_minor', 'currency', 'item_count']
      and props->>'currency' in ('USD', 'VND')
      and props->>'item_count' ~ '^[0-9]+$'
      and (props->>'item_count')::bigint between 1 and 999
      and public.amount_minor_in_bounds(props, 'amount_minor', props->>'currency', false);

  elsif event_name = 'flash_sheet_shown' then
    return keys = array['amount_minor', 'city', 'currency', 'restaurant_slugs']
      and props->>'city' in ('sf', 'hcmc')
      and props->>'currency' in ('USD', 'VND')
      and props->>'amount_minor' ~ '^[0-9]+$'
      and (
        (props->>'currency' = 'VND' and (props->>'amount_minor')::bigint between 10000 and 30000)
        or
        (props->>'currency' = 'USD' and (props->>'amount_minor')::bigint between 200 and 600)
      )
      and jsonb_typeof(props->'restaurant_slugs') = 'array'
      and jsonb_array_length(props->'restaurant_slugs') = 2
      and (
        select bool_and(
          jsonb_typeof(elem) = 'string'
          and length(elem #>> '{}') between 1 and 60
          and (elem #>> '{}') ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        )
        from jsonb_array_elements(props->'restaurant_slugs') elem
      );

  elsif event_name = 'flash_sheet_closed' then
    return keys = array['city', 'outcome', 'restaurant_slug', 'seconds_remaining']
      and props->>'city' in ('sf', 'hcmc')
      and props->>'outcome' in ('restaurant_tapped', 'dismissed', 'expired')
      and props->>'seconds_remaining' ~ '^[0-9]+$'
      and (props->>'seconds_remaining')::int between 0 and 900
      and (
        (props->>'outcome' = 'restaurant_tapped'
          and jsonb_typeof(props->'restaurant_slug') = 'string'
          and props->>'restaurant_slug' <> 'none'
          and length(props->>'restaurant_slug') between 1 and 60
          and props->>'restaurant_slug' ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
        or
        (props->>'outcome' <> 'restaurant_tapped' and props->>'restaurant_slug' = 'none')
      );

  elsif event_name = 'order_placed' then
    return keys = array[
        'amount_minor', 'applied_voucher_ids', 'currency', 'delivery_instructions',
        'drop_off_preset', 'item_count', 'order_id', 'saved_amount_minor', 'utensils'
      ]
      and props->>'order_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and props->>'item_count' ~ '^[0-9]+$'
      and (props->>'item_count')::bigint between 1 and 999
      and props->>'currency' in ('USD', 'VND')
      and public.amount_minor_in_bounds(props, 'amount_minor', props->>'currency', false)
      and public.amount_minor_in_bounds(props, 'saved_amount_minor', props->>'currency', true)
      and props->>'drop_off_preset' in ('home', 'office', 'front_desk')
      and props->>'delivery_instructions' in ('leave_at_door', 'hand_to_me', 'meet_downstairs', 'call_on_arrival')
      and jsonb_typeof(props->'utensils') = 'boolean'
      and jsonb_typeof(props->'applied_voucher_ids') = 'array'
      and jsonb_array_length(props->'applied_voucher_ids') between 0 and 2
      and (
        select coalesce(bool_and(
          v is not null and v in (
            'hcmc-delivery-entry', 'hcmc-discount-t1', 'hcmc-discount-t2', 'hcmc-discount-t3', 'hcmc-flash',
            'sf-delivery-entry', 'sf-discount-t1', 'sf-discount-t2', 'sf-discount-t3', 'sf-flash'
          )
        ), true)
        from jsonb_array_elements_text(props->'applied_voucher_ids') v
      )
      and (
        select count(distinct v) from jsonb_array_elements_text(props->'applied_voucher_ids') v
      ) = jsonb_array_length(props->'applied_voucher_ids');
      -- Contract §7's cross-field invariant on this row — "saved_amount_minor
      -- is 0 iff applied_voucher_ids is []" — is deliberately NOT enforced
      -- here. Decided on #79 (2026-09-26 11:47): a CHECK here would turn a
      -- client arithmetic bug into an order_placed row the store silently
      -- drops, on the primary metric's numerator. An inconsistent row that
      -- lands can be counted and excluded later; a refused one is gone. The
      -- invariant is #89's to enforce client-side. See ADR 0007.

  elsif event_name = 'tracker_viewed' then
    return keys = array['minutes_since_order', 'order_id', 'view_number']
      and props->>'order_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof(props->'minutes_since_order') = 'number'
      and (props->>'minutes_since_order')::numeric >= 0
      and props->>'view_number' ~ '^[0-9]+$'
      and (props->>'view_number')::bigint >= 1;

  elsif event_name = 'order_delivered' then
    return keys = array['minutes_since_order', 'order_id']
      and props->>'order_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof(props->'minutes_since_order') = 'number'
      and (props->>'minutes_since_order')::numeric >= 0;

  elsif event_name = 'rating_submitted' then
    return keys = array['order_id', 'stars', 'tags']
      and props->>'order_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and props->>'stars' ~ '^[0-9]+$'
      and (props->>'stars')::int between 1 and 5
      and jsonb_typeof(props->'tags') = 'array'
      and jsonb_array_length(props->'tags') between 0 and 3
      and (
        select coalesce(bool_and(
          t is not null and t in ('fast', 'great_packaging', 'order_was_correct')
        ), true)
        from jsonb_array_elements_text(props->'tags') t
      )
      and (
        select count(distinct t) from jsonb_array_elements_text(props->'tags') t
      ) = jsonb_array_length(props->'tags');

  else
    return false;
  end if;
end;
$$;
