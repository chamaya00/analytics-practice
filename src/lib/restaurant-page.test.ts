// Restaurant page build-output tests (#130 AC3/AC4) — the rating/review
// count and vehicle icon are static markup on this page (menu-dom.test.ts
// covers the client-rendered menu; this covers what /restaurants/<slug>
// itself ships). Reads dist/ the same way about-page.test.ts does, so this
// proves what the published build actually contains.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { getRestaurant } from './restaurants';
import { formatReviewCount } from './reviews';

const root = process.cwd();

function readRestaurantPage(slug: string) {
  const window = new Window();
  window.document.write(readFileSync(path.join(root, 'dist', 'restaurants', slug, 'index.html'), 'utf-8'));
  return window.document;
}

describe('restaurant page — rating, review count, and vehicle icon (#130 AC3/AC4)', () => {
  it('an HCMC restaurant shows the rating immediately followed by its formatted review count, and a motorbike icon before the ETA', () => {
    const restaurant = getRestaurant('ben-thanh-banh-mi')!;
    const document = readRestaurantPage('ben-thanh-banh-mi');
    const meta = document.querySelector('[data-testid="restaurant-meta"]');
    expect(meta?.textContent).toContain(`★ ${restaurant.rating.toFixed(1)} (${formatReviewCount(restaurant.reviewCount)})`);

    const icon = meta?.querySelector('.vehicle-icon');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('data-vehicle')).toBe('motorbike');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');

    const eta = meta?.querySelector('[data-testid="restaurant-eta"]');
    // Sibling, not a child — menu-dom.ts's renderEta sets this span's own
    // textContent client-side, which would wipe an icon placed inside it.
    expect(icon?.parentElement?.contains(eta!)).toBe(true);
    expect(icon?.contains(eta!)).toBe(false);
  });

  it('an SF restaurant shows a car icon, not a motorbike', () => {
    const document = readRestaurantPage('mission-taqueria');
    const icon = document.querySelector('[data-testid="restaurant-meta"] .vehicle-icon');
    expect(icon?.getAttribute('data-vehicle')).toBe('car');
  });
});
