# Photo credits — two-city catalogue placeholders

Issue #82 (child of #80/#79). Every image the site loads is a committed file
under `public/images/`, served from the site itself — none of it is a
hotlinked URL to another host. **Every file listed below is a placeholder**,
not a downloaded photo: `./scripts/app-render`'s attempt-1 run found outbound
network to Unsplash refused in this sandbox, so nothing here has been
downloaded from the searches #80's design doc names. Each placeholder has the
word "Placeholder" rendered directly on the image, plus a second line naming
what it stands in for, so a reviewer can tell at a glance that it's not the
real photo.

When a later run has outbound network, replace the file at the same path with
a licensed download from the search below and update this row's Status —
nothing importing these paths needs to change.

## City cards (location picker)

| File | Intended Unsplash search | Status |
|---|---|---|
| `public/images/cities/sf.svg` | "san francisco street golden gate" | Placeholder — not yet downloaded |
| `public/images/cities/hcmc.svg` | "ho chi minh city street motorbikes" | Placeholder — not yet downloaded |

## Home feed

| File | Intended source | Status |
|---|---|---|
| `public/images/promo-banner.svg` | Not a licensed photo — UI banner artwork (no Unsplash search named in #80 for this slot) | Placeholder |

## Restaurant hero images

| File | Cuisine | Intended Unsplash search | Status |
|---|---|---|---|
| `public/images/restaurants/mission-taqueria-hero.svg` | SF, tacos | "modern taqueria interior" | Placeholder — not yet downloaded |
| `public/images/restaurants/north-beach-pizzeria-hero.svg` | SF, pizza | "neighborhood pizzeria interior" | Placeholder — not yet downloaded |
| `public/images/restaurants/golden-lotus-dim-sum-hero.svg` | SF, dim sum | "dim sum restaurant interior" | Placeholder — not yet downloaded |
| `public/images/restaurants/ben-thanh-banh-mi-hero.svg` | HCMC, bánh mì | "banh mi shop vietnam" | Placeholder — not yet downloaded |
| `public/images/restaurants/saigon-pho-quan-hero.svg` | HCMC, phở | "vietnamese street food stall" | Placeholder — not yet downloaded |
| `public/images/restaurants/com-tam-quan-nha-hero.svg` | HCMC, cơm tấm | "com tam restaurant vietnam" | Placeholder — not yet downloaded |

## Dish thumbnails

Every item below shares its restaurant's cuisine-level search from #80's
"Photos" section — the design doc names one search per cuisine, not per dish.

| File | Search | Status |
|---|---|---|
| `public/images/dishes/mission-taqueria-al-pastor.svg` | "tacos close up" | Placeholder — not yet downloaded |
| `public/images/dishes/mission-taqueria-carne-asada.svg` | "tacos close up" | Placeholder — not yet downloaded |
| `public/images/dishes/mission-taqueria-chips-guac.svg` | "tacos close up" | Placeholder — not yet downloaded |
| `public/images/dishes/mission-taqueria-horchata.svg` | "tacos close up" | Placeholder — not yet downloaded |
| `public/images/dishes/north-beach-pizzeria-margherita.svg` | "pizza slice close up" | Placeholder — not yet downloaded |
| `public/images/dishes/north-beach-pizzeria-pepperoni.svg` | "pizza slice close up" | Placeholder — not yet downloaded |
| `public/images/dishes/north-beach-pizzeria-garlic-knots.svg` | "pizza slice close up" | Placeholder — not yet downloaded |
| `public/images/dishes/north-beach-pizzeria-caesar.svg` | "pizza slice close up" | Placeholder — not yet downloaded |
| `public/images/dishes/golden-lotus-dim-sum-har-gow.svg` | "dim sum bamboo steamer" | Placeholder — not yet downloaded |
| `public/images/dishes/golden-lotus-dim-sum-siu-mai.svg` | "dim sum bamboo steamer" | Placeholder — not yet downloaded |
| `public/images/dishes/golden-lotus-dim-sum-congee.svg` | "dim sum bamboo steamer" | Placeholder — not yet downloaded |
| `public/images/dishes/golden-lotus-dim-sum-noodles.svg` | "dim sum bamboo steamer" | Placeholder — not yet downloaded |
| `public/images/dishes/ben-thanh-banh-mi-thit-nuong.svg` | "banh mi sandwich close up" | Placeholder — not yet downloaded |
| `public/images/dishes/ben-thanh-banh-mi-op-la.svg` | "banh mi sandwich close up" | Placeholder — not yet downloaded |
| `public/images/dishes/ben-thanh-banh-mi-ca-phe-sua-da.svg` | "banh mi sandwich close up" | Placeholder — not yet downloaded |
| `public/images/dishes/ben-thanh-banh-mi-tra-da.svg` | "banh mi sandwich close up" | Placeholder — not yet downloaded |
| `public/images/dishes/saigon-pho-quan-bo.svg` | "pho bowl close up" | Placeholder — not yet downloaded |
| `public/images/dishes/saigon-pho-quan-ga.svg` | "pho bowl close up" | Placeholder — not yet downloaded |
| `public/images/dishes/saigon-pho-quan-goi-cuon.svg` | "pho bowl close up" | Placeholder — not yet downloaded |
| `public/images/dishes/saigon-pho-quan-cha-gio.svg` | "pho bowl close up" | Placeholder — not yet downloaded |
| `public/images/dishes/com-tam-quan-nha-suon-nuong.svg` | "vietnamese broken rice plate" | Placeholder — not yet downloaded |
| `public/images/dishes/com-tam-quan-nha-bi-cha.svg` | "vietnamese broken rice plate" | Placeholder — not yet downloaded |
| `public/images/dishes/com-tam-quan-nha-nuoc-mia.svg` | "vietnamese broken rice plate" | Placeholder — not yet downloaded |
| `public/images/dishes/com-tam-quan-nha-sam-lanh.svg` | "vietnamese broken rice plate" | Placeholder — not yet downloaded |

## Weight budget (#80: home feed first paint ≤ 900KB total, each restaurant thumbnail ≤ 40KB)

Every placeholder above is a small text-on-solid-color SVG, each under 1KB —
`src/lib/image-budget.test.ts` asserts this against the committed files
directly, both per-thumbnail and for the feed's first-paint set (one banner
plus up to six restaurant hero thumbnails). Replacing a placeholder with a
real compressed WebP/AVIF download will need re-checking against the same
budget; the test is what re-proves it, not this table.
