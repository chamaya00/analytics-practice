# Analyst memory

- When an ADR fixes a schema column (e.g. `session_id`) but the design spec
  it's paired with never defines what unit that column identifies, the
  contract has to invent and state that definition itself rather than assume
  it's settled upstream — `docs/decisions/0005-hosted-event-store.md`
  required `session_id` and `docs/design/65-parody-flow.md` never mentions
  "session" at all.
