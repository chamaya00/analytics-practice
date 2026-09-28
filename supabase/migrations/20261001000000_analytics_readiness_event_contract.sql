-- #224: additive migration for the analytics-readiness event contract
-- (docs/measurement/219-analytics-readiness-contract.md, §13 items 1-6),
-- amending ADR 0005 and ADR 0007 per
-- docs/decisions/0012-analytics-readiness-event-shapes.md. Strictly
-- additive: this file replaces `event_is_valid` and the `event_name` CHECK
-- only; no applied migration is edited and no stored row is changed.
--
-- `session_started`, the `is_internal` column and `events_clean` are #225's
-- (§13 item 7), so `session_started` is not in the name list below yet.
--
-- STRICT SUPERSET (contract §13, amendment 4): every (event_name, props)
-- pair the previous `event_is_valid` (20260926000000_two_city_event_contract.sql)
-- accepts is still accepted here. Tabs that are already open keep sending
-- #81's shapes, and a refused row is lost silently (ADR 0005). This
-- deliberately reverses #81's "old shapes rejected" posture (its AC7).
-- Cross-field invariants (currency against city, saved amount against
-- vouchers, ...) are still NOT checked in the store; ADR 0007 keeps them in
-- client tests.

-- Dropped and re-added `not valid`, as in #85, so historical rows aren't
-- re-scanned. The 11 names #81 kept, plus the six new events.
alter table public.events
  drop constraint events_event_name_check;

alter table public.events
  add constraint events_event_name_check check (event_name in (
    'location_selected', 'home_viewed', 'restaurant_opened', 'cart_viewed',
    'checkout_viewed', 'flash_sheet_shown', 'flash_sheet_closed',
    'order_placed', 'tracker_viewed', 'order_delivered', 'rating_submitted',
    'driver_rating_submitted', 'tip_sent', 'sign_in_prompt_shown',
    'sign_in_started', 'sign_in_completed', 'wallet_short_shown'
  )) not valid;

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
      and props->>'city' in ('sf', 'hcmc', 'la')
      and jsonb_typeof(props->'is_switch') = 'boolean';

  elsif event_name = 'home_viewed' then
    return keys = array['city']
      and props->>'city' in ('sf', 'hcmc', 'la');

  elsif event_name = 'restaurant_opened' then
    return keys = array['city', 'restaurant_slug']
      and props->>'city' in ('sf', 'hcmc', 'la')
      and jsonb_typeof(props->'restaurant_slug') = 'string'
      and length(props->>'restaurant_slug') between 1 and 60
      and props->>'restaurant_slug' ~ '^[a-z0-9]+(-[a-z0-9]+)*$';

  elsif event_name = 'cart_viewed' then
    -- #81's 3-key shape, or the 4-key shape with city.
    return (
        keys = array['amount_minor', 'currency', 'item_count']
        or (keys = array['amount_minor', 'city', 'currency', 'item_count']
            and props->>'city' in ('sf', 'hcmc', 'la'))
      )
      and props->>'currency' in ('USD', 'VND')
      and props->>'item_count' ~ '^[0-9]+$'
      and (props->>'item_count')::bigint between 0 and 999
      and public.amount_minor_in_bounds(props, 'amount_minor', props->>'currency', true);

  elsif event_name = 'checkout_viewed' then
    return (
        keys = array['amount_minor', 'currency', 'item_count']
        or (keys = array['amount_minor', 'city', 'currency', 'item_count']
            and props->>'city' in ('sf', 'hcmc', 'la'))
      )
      and props->>'currency' in ('USD', 'VND')
      and props->>'item_count' ~ '^[0-9]+$'
      and (props->>'item_count')::bigint between 1 and 999
      and public.amount_minor_in_bounds(props, 'amount_minor', props->>'currency', false);

  elsif event_name = 'flash_sheet_shown' then
    -- 5-6 distinct slugs (the product's real draw), or 2 as #81 accepted
    -- (kept only for the strict superset; no current client sends 2).
    return keys = array['amount_minor', 'city', 'currency', 'restaurant_slugs']
      and props->>'city' in ('sf', 'hcmc', 'la')
      and props->>'currency' in ('USD', 'VND')
      and props->>'amount_minor' ~ '^[0-9]+$'
      and (
        (props->>'currency' = 'VND' and (props->>'amount_minor')::bigint between 10000 and 30000)
        or
        (props->>'currency' = 'USD' and (props->>'amount_minor')::bigint between 200 and 600)
      )
      and jsonb_typeof(props->'restaurant_slugs') = 'array'
      and jsonb_array_length(props->'restaurant_slugs') in (2, 5, 6)
      and (
        select bool_and(
          jsonb_typeof(elem) = 'string'
          and length(elem #>> '{}') between 1 and 60
          and (elem #>> '{}') ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        )
        from jsonb_array_elements(props->'restaurant_slugs') elem
      )
      and (
        jsonb_array_length(props->'restaurant_slugs') = 2
        or (
          select count(distinct elem #>> '{}') from jsonb_array_elements(props->'restaurant_slugs') elem
        ) = jsonb_array_length(props->'restaurant_slugs')
      );

  elsif event_name = 'flash_sheet_closed' then
    return keys = array['city', 'outcome', 'restaurant_slug', 'seconds_remaining']
      and props->>'city' in ('sf', 'hcmc', 'la')
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
    -- #81's 9-key shape, or the 14-key shape (contract §8). The nine shared
    -- fields are checked the same way for both; the five new ones only when
    -- present. Cross-field invariants are not enforced (ADR 0007).
    return (
        keys = array[
          'amount_minor', 'applied_voucher_ids', 'currency', 'delivery_instructions',
          'drop_off_preset', 'item_count', 'order_id', 'saved_amount_minor', 'utensils'
        ]
        or (
          keys = array[
            'amount_minor', 'applied_voucher_ids', 'city', 'currency', 'delivery_instructions',
            'drop_off_preset', 'item_count', 'order_id', 'saved_amount_minor',
            'thanks_voucher_amount_minor', 'utensils', 'vip_level', 'vip_saved_amount_minor',
            'wallet_paid'
          ]
          and props->>'city' in ('sf', 'hcmc', 'la')
          and props->>'vip_level' in ('none', 'gold', 'platinum')
          and jsonb_typeof(props->'wallet_paid') = 'boolean'
          and public.amount_minor_in_bounds(props, 'thanks_voucher_amount_minor', props->>'currency', true)
          and public.amount_minor_in_bounds(props, 'vip_saved_amount_minor', props->>'currency', true)
        )
      )
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
            'sf-delivery-entry', 'sf-discount-t1', 'sf-discount-t2', 'sf-discount-t3', 'sf-flash',
            'la-delivery-entry', 'la-discount-t1', 'la-discount-t2', 'la-discount-t3', 'la-flash'
          )
        ), true)
        from jsonb_array_elements_text(props->'applied_voucher_ids') v
      )
      and (
        select count(distinct v) from jsonb_array_elements_text(props->'applied_voucher_ids') v
      ) = jsonb_array_length(props->'applied_voucher_ids');

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

  -- The six new events (contract §8). Each is wrapped in coalesce so a
  -- missing or mistyped value refuses the row rather than yielding null,
  -- which a CHECK would let through.
  elsif event_name = 'driver_rating_submitted' then
    return coalesce(
      keys = array['order_id', 'stars']
      and props->>'order_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and props->>'stars' ~ '^[0-9]+$'
      and (props->>'stars')::int between 1 and 5,
      false);

  elsif event_name = 'tip_sent' then
    return coalesce(
      keys = array['currency', 'order_id', 'tip_amount_minor']
      and props->>'order_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof(props->'tip_amount_minor') = 'number'
      and (
        (props->>'currency' = 'USD' and props->>'tip_amount_minor' in ('100', '200', '300'))
        or
        (props->>'currency' = 'VND' and props->>'tip_amount_minor' in ('10000', '20000', '30000'))
      ),
      false);

  elsif event_name = 'sign_in_prompt_shown' then
    return coalesce(
      keys = array['surface']
      and props->>'surface' in ('checkout', 'tip'),
      false);

  elsif event_name = 'sign_in_started' then
    return coalesce(
      keys = array['provider', 'surface']
      and props->>'provider' in ('google', 'apple')
      and props->>'surface' in ('checkout', 'tip'),
      false);

  elsif event_name = 'sign_in_completed' then
    return coalesce(
      keys = array['outcome', 'provider', 'surface']
      and props->>'outcome' in ('success', 'failed')
      and props->>'provider' in ('google', 'apple')
      and props->>'surface' in ('checkout', 'tip'),
      false);

  elsif event_name = 'wallet_short_shown' then
    return coalesce(
      keys = array['city', 'surface']
      and props->>'city' in ('sf', 'hcmc', 'la')
      and props->>'surface' in ('checkout', 'tip'),
      false);

  else
    return false;
  end if;
end;
$$;
