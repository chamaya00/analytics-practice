-- #188: additive migration closing a privilege hole in the wallet functions
-- — ADR 0008 (docs/decisions/0008-play-money-wallet-and-sign-in.md, lines
-- 123 and 273), objective #186.
-- Strictly additive per house rules: this file only revokes grants;
-- 20260925000000_events.sql, 20260926000000_two_city_event_contract.sql,
-- 20260927000000_wallet.sql and 20260928000000_wallet_tip.sql are untouched.
--
-- Supabase grants `execute` on every new `public` function to `anon` and
-- `authenticated` directly, through its own default privileges, not only
-- through the `PUBLIC` pseudo-role. `20260927000000_wallet.sql` and
-- `20260928000000_wallet_tip.sql` only run `revoke all ... from public`
-- (and `revoke execute ... from public`) on these four functions before
-- granting execute back to `authenticated` alone — revoking `PUBLIC`'s own
-- grant never touches a grant already made directly to a named role, so on
-- the live database `anon` still holds execute on all four. ADR 0008 called
-- for `revoke execute ... from public, anon`; only the `public` half ever
-- shipped.
--
-- `public.wallet_ready()` is deliberately excluded: it must stay
-- executable by `anon` (D1's fallback, #140) — it is the "is the wallet
-- configured?" probe that runs for signed-out visitors, and revoking it
-- would break checkout for every one of them.

revoke execute on function public.wallet_get() from anon;
revoke execute on function public.wallet_claim_drip() from anon;
revoke execute on function public.wallet_debit(uuid, text, bigint) from anon;
revoke execute on function public.wallet_tip(uuid, bigint) from anon;
