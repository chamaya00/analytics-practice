# Lessons for the researcher in this repository

<!--
One line per lesson, specific to this repository, stated as a rule with the
reason attached. Hard cap of 40 non-blank lines, enforced by the guard.

Past the cap, rewrite rather than append: merge two lessons that say the same
thing, drop the one that has stopped being relevant, tighten what survives.

Delete any lesson that has graduated into a test, a lint rule, or a type.
-->

- Check that a local worktree actually contains the merged PRs the brief names before citing its code: #232's worktree predated PR #250's merge, so the merged `src/` was read from `raw.githubusercontent.com/chamaya00/analytics-practice/main/...` (the repo is public). `api.github.com` returned 403.
- Vendor docs sites (vercel.com, supabase.com, posthog.com, Google, Snowflake, Databricks, duckdb.org, getdbt.com) are blocked by the egress proxy while GitHub is reachable: read vendor docs repos raw (supabase/supabase, PostHog/posthog.com, duckdb/*, dbt-labs/*, easylist/easylist, github/docs) for V-grade claims, and tag search-extract-only claims Vs (#267).
