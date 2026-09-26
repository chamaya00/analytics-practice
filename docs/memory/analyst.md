# Analyst memory

- When an ADR fixes a schema column (e.g. `session_id`) but the design spec
  it's paired with never defines what unit that column identifies, the
  contract has to invent and state that definition itself rather than assume
  it's settled upstream — `docs/decisions/0005-hosted-event-store.md`
  required `session_id` and `docs/design/65-parody-flow.md` never mentions
  "session" at all.
- `event_is_valid` validates each event's `props` by an exact key-set match
  (`keys = array[...]`), which has no way to express an optional or nullable
  prop — an event needing a "not applicable here" value (e.g. which
  restaurant was tapped, when the sheet was instead dismissed) needs a fixed
  sentinel value in that slot (e.g. the literal `"none"`), never an omitted
  key, or the exact-match check refuses the row outright.
