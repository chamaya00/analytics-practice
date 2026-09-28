// #233 AC1: LA's catalogue is exactly docs/design/229-la-catalogue.md's. The
// expected values are read from the spec's own tables rather than retyped
// here, so a name, slug, dish or price that drifts from the spec fails.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_RESTAURANTS, CUISINE_SHORTCUTS, getRestaurant, restaurantsForCity } from './restaurants';
import { DRIVERS_BY_CITY } from './drivers';

interface SpecDish {
  section: string;
  id: string;
  name: string;
  description: string;
  amountMinor: number;
}

interface SpecRestaurant {
  slug: string;
  name: string;
  cuisineTag: string;
  rating: number;
  reviewCount: number;
  deliveryFeeMinor: number;
  hasDeal: boolean;
  heroImage: string;
  dishes: SpecDish[];
}

const SPEC = readFileSync(path.join(process.cwd(), 'docs', 'design', '229-la-catalogue.md'), 'utf-8');

function specRestaurants(): SpecRestaurant[] {
  const body = SPEC.slice(SPEC.indexOf('#### 1. '), SPEC.indexOf('## Photo manifest'));
  return body
    .split(/^#### \d+\. .*$/m)
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const meta = block
        .split('\n')
        .find((line) => line.startsWith('`'))!
        .match(/^`([^`]+)` · cuisine tag \*\*(.+?)\*\* · rating ([\d.]+) · (\d+) reviews · delivery fee `(\d+)` .*?· `hasDeal: (true|false)` · hero `([^`]+)`$/);
      if (!meta) throw new Error(`unparsed spec block: ${block.slice(0, 80)}`);
      const name = SPEC.match(new RegExp(`^#### \\d+\\. (.+)\\n\\n\`${meta[1]}\``, 'm'))![1];
      const dishes = block
        .split('\n')
        .map((line) => line.match(/^\| ([^|]+?) \| `([^`]+)` \| ([^|]+?) \| ([^|]+?) \| (\d+) \|$/))
        .filter((match): match is RegExpMatchArray => match !== null)
        .map(([, section, id, dishName, description, amount]) => ({
          section,
          id,
          name: dishName,
          description,
          amountMinor: Number(amount),
        }));
      return {
        slug: meta[1],
        name,
        cuisineTag: meta[2],
        rating: Number(meta[3]),
        reviewCount: Number(meta[4]),
        deliveryFeeMinor: Number(meta[5]),
        hasDeal: meta[6] === 'true',
        heroImage: meta[7],
        dishes,
      };
    });
}

describe("LA's catalogue matches docs/design/229-la-catalogue.md (#233 AC1)", () => {
  const spec = specRestaurants();

  it('the spec itself parses to 14 restaurants and 70 dishes (guards the parser, not the site)', () => {
    expect(spec).toHaveLength(14);
    expect(spec.flatMap((restaurant) => restaurant.dishes)).toHaveLength(70);
  });

  it("restaurantsForCity('la') returns exactly the spec's 14, in the spec's order, with its names, slugs, tags, ratings, fees, deals and heroes", () => {
    const la = restaurantsForCity('la');
    expect(la.map((restaurant) => restaurant.slug)).toEqual(spec.map((restaurant) => restaurant.slug));
    for (const [index, expected] of spec.entries()) {
      const actual = la[index];
      expect(actual.city, expected.slug).toBe('la');
      expect(
        {
          name: actual.name,
          cuisineTag: actual.cuisineTag,
          rating: actual.rating,
          reviewCount: actual.reviewCount,
          deliveryFeeMinor: actual.deliveryFeeMinor,
          hasDeal: actual.hasDeal,
          heroImage: actual.heroImage,
        },
        expected.slug,
      ).toEqual({
        name: expected.name,
        cuisineTag: expected.cuisineTag,
        rating: expected.rating,
        reviewCount: expected.reviewCount,
        deliveryFeeMinor: expected.deliveryFeeMinor,
        hasDeal: expected.hasDeal,
        heroImage: expected.heroImage,
      });
    }
  });

  it("every LA restaurant's menu is the spec's dishes, sections and USD minor-unit prices, each dish image at /images/dishes/<id>.jpg", () => {
    for (const expected of spec) {
      const actual = getRestaurant(expected.slug)!;
      const dishes = actual.menu.flatMap((section) =>
        section.items.map((item) => ({
          section: section.title,
          id: item.id,
          name: item.name,
          description: item.description,
          amountMinor: item.amountMinor,
          image: item.image,
        })),
      );
      expect(dishes, expected.slug).toEqual(expected.dishes.map((dish) => ({ ...dish, image: `/images/dishes/${dish.id}.jpg` })));
    }
  });

  it('each LA restaurant has 4-6 dishes', () => {
    for (const restaurant of restaurantsForCity('la')) {
      const count = restaurant.menu.reduce((sum, section) => sum + section.items.length, 0);
      expect(count, restaurant.slug).toBeGreaterThanOrEqual(4);
      expect(count, restaurant.slug).toBeLessThanOrEqual(6);
    }
  });

  it('SF and HCMC keep their 14 each, and ALL_RESTAURANTS carries all 42 with no slug or dish id repeated', () => {
    expect(restaurantsForCity('sf')).toHaveLength(14);
    expect(restaurantsForCity('hcmc')).toHaveLength(14);
    expect(ALL_RESTAURANTS).toHaveLength(42);
    expect(new Set(ALL_RESTAURANTS.map((restaurant) => restaurant.slug)).size).toBe(42);
    const dishIds = ALL_RESTAURANTS.flatMap((restaurant) => restaurant.menu.flatMap((section) => section.items.map((item) => item.id)));
    expect(new Set(dishIds).size).toBe(dishIds.length);
  });

  it("CUISINE_SHORTCUTS.la is exactly the 14 cuisine tags, in catalogue order (as SF's are)", () => {
    expect(CUISINE_SHORTCUTS.la).toEqual(restaurantsForCity('la').map((restaurant) => restaurant.cuisineTag));
  });
});

describe("LA's drivers follow #229's decision (#233 AC2)", () => {
  it("DRIVERS_BY_CITY.la is SF's own pool, not a copy or a new one", () => {
    expect(DRIVERS_BY_CITY.la).toBe(DRIVERS_BY_CITY.sf);
    expect(DRIVERS_BY_CITY.la.every((driver) => driver.id.startsWith('sf-driver-'))).toBe(true);
  });
});
