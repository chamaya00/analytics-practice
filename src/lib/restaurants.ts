// Fixed, compile-time restaurant/menu content — docs/design/65-parody-flow.md
// screens 2 and 3 ("built at compile time, not a runtime fetch"). Names and
// copy from docs/design/72-dontdropthatpromo-identity.md's over-invested-
// courier voice.

export interface MenuItem {
  id: string;
  name: string;
  priceCents: number;
}

export interface Restaurant {
  slug: string;
  name: string;
  cuisineTag: string;
  eta: string;
  menu: MenuItem[];
}

export const RESTAURANTS: Restaurant[] = [
  {
    slug: 'fumble-and-sons',
    name: 'Fumble & Sons',
    cuisineTag: 'Comfort food, allegedly',
    eta: 'ETA: yes',
    menu: [
      { id: 'fumble-and-sons-mashed-potatoes', name: 'Mashed potatoes, dropped once', priceCents: 700 },
      { id: 'fumble-and-sons-meatloaf', name: 'Meatloaf, recovered fumble', priceCents: 1200 },
      { id: 'fumble-and-sons-gravy-extra', name: 'Extra gravy, held with both hands', priceCents: 300 },
    ],
  },
  {
    slug: 'one-job-pizza',
    name: 'One Job Pizza',
    cuisineTag: 'Pizza (one job)',
    eta: 'ETA: yes',
    menu: [
      { id: 'one-job-pizza-margherita', name: 'Margherita, carried flat', priceCents: 1400 },
      { id: 'one-job-pizza-pepperoni', name: 'Pepperoni, guarded closely', priceCents: 1600 },
      { id: 'one-job-pizza-garlic-knots', name: 'Garlic knots, white-knuckled', priceCents: 600 },
    ],
  },
  {
    slug: 'try-not-to-wok',
    name: 'Try Not To Wok',
    cuisineTag: 'Stir-fry, nervously',
    eta: 'ETA: yes',
    menu: [
      { id: 'try-not-to-wok-fried-rice', name: 'Fried rice, white-knuckle transit', priceCents: 900 },
      { id: 'try-not-to-wok-noodles', name: 'Lo mein, no spills so far', priceCents: 1000 },
      { id: 'try-not-to-wok-spring-rolls', name: 'Spring rolls, held upright', priceCents: 500 },
    ],
  },
];

export function getRestaurant(slug: string): Restaurant | undefined {
  return RESTAURANTS.find((restaurant) => restaurant.slug === slug);
}

export function getMenuItem(itemId: string): { restaurant: Restaurant; item: MenuItem } | undefined {
  for (const restaurant of RESTAURANTS) {
    const item = restaurant.menu.find((candidate) => candidate.id === itemId);
    if (item) return { restaurant, item };
  }
  return undefined;
}
