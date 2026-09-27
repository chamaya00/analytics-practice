# ADR 0010: Driver avatars are DiceBear Avataaars, vendored at build time

Date: 2026-09-27
Status: accepted

## Context

#148's driver card (parent #134, spec #147) needs an illustrated headshot per
driver — 50 across the two cities' pools (`drivers.ts`) — that is "Bitmoji/Mii
style," never a photograph, and fetches nothing from a new host at runtime
(owner, O1 on #140). This is the first dependency from `npm`'s avatar-generator
category this project uses, so it gets an ADR rather than a silent add.

#147 already chose the generator and style during design (its own "Avatar
style" section): DiceBear's Avataaars, run against a constrained option set per
city so an HCMC driver's pool never draws blonde or pink hair. That document
also flagged one implementation trap: DiceBear's SVGs reuse internal element
ids, so several inline avatars on one page draw only the first one — the fix
is to load each as its own `<img src="...">` file rather than inlining the
markup, which this ADR's build step already produces.

## Decision

`@dicebear/core` and `@dicebear/avataaars` are pinned `devDependencies`
(`9.4.3` / `9.4.2`, the exact versions #147 built its mocks from). npm is
already this project's package ecosystem, so this is a new package, not a new
category.

`scripts/generate-driver-avatars.mjs` reads every driver from `drivers.ts` and
writes one SVG per `id` to `public/avatars/drivers/<id>.svg`, run by
`npm run generate-driver-avatars`. It is not wired into `npm run build` or CI:
the 50 files are generated once and committed, exactly as `image-budget.
test.ts` already assumes for `public/images/` — nothing is generated in the
browser, and nothing leaves the origin at request time. The seed for each file
is the driver's own stable `id`, so the same driver always draws the same
face and a re-run of the script is a no-op change (unless `drivers.ts` or the
option set changes).

Avatars live under `public/avatars/drivers/`, not `public/images/`:
`image-budget.test.ts`'s credits test requires every file under
`public/images/` to carry an "Unsplash License" row, and an avatar recorded
under that licence would be false. A sibling assertion in the same test file
measures all 50 against a 16KB per-file cap and a 300KB total cap (`public/
avatars/drivers` totals roughly 258KB today).

**Licences, quoted from the packages actually installed** (`node_modules/
@dicebear/avataaars/LICENSE`):

- **Code:** MIT, `@dicebear/core` and `@dicebear/avataaars` (Copyright 2024
  Florian Körner).
- **Artwork:** "Source: Avataaars (https://avataaars.com/) / Designer: Pablo
  Stanley / License: Free for personal and commercial use
  (https://avataaars.com/)." The package's own README carries the same text
  DiceBear's style page uses: "based on Avataaars by Pablo Stanley, licensed
  under Free for personal and commercial use. / Remix of the original."
- Attribution is not required by that licence. `/about/` carries one line
  anyway ("Driver avatars: Avataaars by Pablo Stanley, via DiceBear (MIT).")
  so the provenance stays findable next to the photo credits, matching #147's
  recommendation.

## Consequences

Regenerating a driver's avatar (a `drivers.ts` id changing, or the option set
being retuned) is a script run plus a commit, not a runtime concern — the
built site never imports `@dicebear/*` at all, so neither package adds
anything to a shipped bundle. `image-budget.test.ts`'s existing "no image is
hotlinked" assertion already covers the no-runtime-fetch rule for these files
the same way it does for `public/images/`.

The two packages are pinned exactly (no `^`) since a version bump can change
what a given seed draws — the visual identity of "this is Minh T.'s face"
would silently drift on an unrelated `npm update`. Bumping either is a
deliberate, re-rendered decision, not routine maintenance.

## Alternatives rejected

- **Hand-drawn SVG avatars.** Rejected in #147's own design pass: 50 distinct,
  consistent illustrated faces by hand is disproportionate to this issue's
  scope, and DiceBear's Avataaars style already reads as the Bitmoji/Mii
  reference the owner asked for.
- **Fetching avatars from DiceBear's hosted API at runtime.** Rejected by O1
  directly: the page must fetch nothing from a new host, and a hosted API is
  exactly that, plus a runtime dependency on a service this project doesn't
  control.
- **A CC-BY-licensed DiceBear style (personas, micah, adventurer, big-smile,
  toon-head).** Rejected in #147: each would require attribution wired
  correctly through this pipeline, and none read as "Bitmoji" as clearly as
  Avataaars did in the design pass's contact sheet.
