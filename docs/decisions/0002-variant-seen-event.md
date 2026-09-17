# ADR 0002: A `variant_seen` event alongside vote events in `poll.events`

Date: 2026-09-17
Status: accepted

## Context

`docs/design/3-swipe-poll.md` defines `poll.events` as one entry per vote,
and defines "Total votes cast" as the length of that array. It also fixes
`poll.variant` and `poll.events` as the only two storage keys any component
may read or write — "Nothing else holds state."

Issue #5's acceptance criterion 4 requires that when the A/B variant is
assigned, "an event records which variant they saw," checked independently
of any vote being cast. A visitor who never votes must still have that
assignment recorded as an event. There is no third storage key available to
hold it without contradicting the design doc's two-key constraint, and the
design doc does not anticipate this second event shape.

## Decision

`poll.events` holds a discriminated union of two event types: `vote`
(`pairId`, `option`, `direction`, `variant`, `timestamp` — unchanged from the
design doc, and the one-sentence Supabase `votes(option, direction, variant,
ts)` mapping from acceptance criterion 2 describes this variant alone) and
`variant_seen` (`variant`, `timestamp`), appended exactly once per browser,
at the moment a variant is first assigned. "Total votes cast," "votes per
option," and "votes per variant" are all computed by filtering `poll.events`
to `type === 'vote'` first, then reducing — still nothing but a read of the
one event log, no separately maintained counter, just no longer a bare
`.length`.

## Consequences

This keeps the two-key constraint intact and keeps every dogfooding number
derived from `poll.events` alone, which is the property the design doc and
issue #5 both care about. It means "total votes cast" is `events.filter(e
=> e.type === 'vote').length` rather than `events.length` — a reader of the
design doc alone would expect the latter, so this ADR exists to make the
divergence explicit rather than silent. A future event type added to this
log needs the same filter-first treatment applied to any stats function
that must stay vote-only.

## Alternatives rejected

- **A third storage key for variant-impression events.** Rejected: the
  design doc is explicit that only `poll.variant` and `poll.events` hold
  state; adding a key re-decides that without the design doc being wrong
  about anything an event log can't already represent.
- **No `variant_seen` event; treat the persisted `poll.variant` value alone
  as satisfying "an event records which variant they saw."** Rejected: the
  acceptance criterion's own test asserts a *recorded event*, distinct from
  variant persistence, and a visitor who never votes would otherwise have no
  such event anywhere in the log.
