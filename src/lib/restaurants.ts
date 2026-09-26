// Fixed, compile-time restaurant/menu content for both cities — docs/design/
// 80-two-city-brand-and-flow.md, "Home feed" and "Restaurant" screens, and
// its own "guesses" section: plausible, licensable-photo-backed rosters, not
// the only valid set. Replaces the parody catalogue
// (docs/design/65-parody-flow.md / 72-dontdropthatpromo-identity.md) in
// full — no restaurant or dish name below is a real chain's.
//
// Every photo path here is a committed placeholder (docs/design/
// 80-photo-credits.md carries the intended Unsplash search per image, not
// yet downloaded — outbound network is refused in this environment).

import type { City, Currency } from './money';
import { currencyForCity } from './money';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  amountMinor: number;
  image: string;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export interface Restaurant {
  slug: string;
  name: string;
  city: City;
  cuisineTag: string;
  rating: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  /** 0 means the fee shows as "Free" — no deal makes any fee 0 in this catalogue yet (#87's job). */
  deliveryFeeMinor: number;
  hasDeal: boolean;
  heroImage: string;
  menu: MenuSection[];
}

export function currencyForRestaurant(restaurant: Restaurant): Currency {
  return currencyForCity(restaurant.city);
}

export function etaRangeLabel(restaurant: Restaurant): string {
  return `${restaurant.etaMinMinutes}–${restaurant.etaMaxMinutes} min`;
}

const SF_RESTAURANTS: Restaurant[] = [
  {
    slug: 'mission-taqueria',
    name: 'Mission Taqueria',
    city: 'sf',
    cuisineTag: 'Tacos',
    rating: 4.6,
    etaMinMinutes: 20,
    etaMaxMinutes: 30,
    deliveryFeeMinor: 199,
    hasDeal: true,
    heroImage: '/images/restaurants/mission-taqueria-hero.svg',
    menu: [
      {
        title: 'Tacos',
        items: [
          {
            id: 'mission-taqueria-al-pastor',
            name: 'Al pastor taco',
            description: 'Marinated pork, pineapple, cilantro, onion.',
            amountMinor: 425,
            image: '/images/dishes/mission-taqueria-al-pastor.svg',
          },
          {
            id: 'mission-taqueria-carne-asada',
            name: 'Carne asada taco',
            description: 'Grilled steak, salsa verde, lime.',
            amountMinor: 475,
            image: '/images/dishes/mission-taqueria-carne-asada.svg',
          },
        ],
      },
      {
        title: 'Sides',
        items: [
          {
            id: 'mission-taqueria-chips-guac',
            name: 'Chips & guacamole',
            description: 'House-made guacamole, fresh-fried chips.',
            amountMinor: 650,
            image: '/images/dishes/mission-taqueria-chips-guac.svg',
          },
          {
            id: 'mission-taqueria-horchata',
            name: 'Horchata',
            description: 'Rice and cinnamon, served cold.',
            amountMinor: 400,
            image: '/images/dishes/mission-taqueria-horchata.svg',
          },
        ],
      },
    ],
  },
  {
    slug: 'north-beach-pizzeria',
    name: 'North Beach Pizzeria',
    city: 'sf',
    cuisineTag: 'Pizza',
    rating: 4.4,
    etaMinMinutes: 25,
    etaMaxMinutes: 40,
    deliveryFeeMinor: 299,
    hasDeal: false,
    heroImage: '/images/restaurants/north-beach-pizzeria-hero.svg',
    menu: [
      {
        title: 'Pizza',
        items: [
          {
            id: 'north-beach-pizzeria-margherita',
            name: 'Margherita',
            description: 'San Marzano tomato, mozzarella, basil.',
            amountMinor: 1650,
            image: '/images/dishes/north-beach-pizzeria-margherita.svg',
          },
          {
            id: 'north-beach-pizzeria-pepperoni',
            name: 'Pepperoni',
            description: 'Mozzarella, cup-and-char pepperoni.',
            amountMinor: 1850,
            image: '/images/dishes/north-beach-pizzeria-pepperoni.svg',
          },
        ],
      },
      {
        title: 'Starters',
        items: [
          {
            id: 'north-beach-pizzeria-garlic-knots',
            name: 'Garlic knots',
            description: 'Baked to order, parsley, garlic butter.',
            amountMinor: 750,
            image: '/images/dishes/north-beach-pizzeria-garlic-knots.svg',
          },
          {
            id: 'north-beach-pizzeria-caesar',
            name: 'Caesar salad',
            description: 'Romaine, shaved parmesan, croutons.',
            amountMinor: 950,
            image: '/images/dishes/north-beach-pizzeria-caesar.svg',
          },
        ],
      },
    ],
  },
  {
    slug: 'golden-lotus-dim-sum',
    name: 'Golden Lotus Dim Sum',
    city: 'sf',
    cuisineTag: 'Dim sum',
    rating: 4.7,
    etaMinMinutes: 30,
    etaMaxMinutes: 45,
    deliveryFeeMinor: 249,
    hasDeal: false,
    heroImage: '/images/restaurants/golden-lotus-dim-sum-hero.svg',
    menu: [
      {
        title: 'Steamed',
        items: [
          {
            id: 'golden-lotus-dim-sum-har-gow',
            name: 'Har gow',
            description: 'Shrimp dumplings, bamboo steamer.',
            amountMinor: 895,
            image: '/images/dishes/golden-lotus-dim-sum-har-gow.svg',
          },
          {
            id: 'golden-lotus-dim-sum-siu-mai',
            name: 'Siu mai',
            description: 'Pork and shrimp dumplings.',
            amountMinor: 850,
            image: '/images/dishes/golden-lotus-dim-sum-siu-mai.svg',
          },
        ],
      },
      {
        title: 'Bowls',
        items: [
          {
            id: 'golden-lotus-dim-sum-congee',
            name: 'Century egg congee',
            description: 'Slow-simmered rice porridge.',
            amountMinor: 795,
            image: '/images/dishes/golden-lotus-dim-sum-congee.svg',
          },
          {
            id: 'golden-lotus-dim-sum-noodles',
            name: 'Rice noodle rolls',
            description: 'Soy-glazed, sesame, scallion.',
            amountMinor: 825,
            image: '/images/dishes/golden-lotus-dim-sum-noodles.svg',
          },
        ],
      },
    ],
  },
];

const HCMC_RESTAURANTS: Restaurant[] = [
  {
    slug: 'ben-thanh-banh-mi',
    name: 'Bến Thành Bánh Mì',
    city: 'hcmc',
    cuisineTag: 'Bánh mì',
    rating: 4.8,
    etaMinMinutes: 15,
    etaMaxMinutes: 25,
    deliveryFeeMinor: 10000,
    hasDeal: true,
    heroImage: '/images/restaurants/ben-thanh-banh-mi-hero.svg',
    menu: [
      {
        title: 'Bánh mì',
        items: [
          {
            id: 'ben-thanh-banh-mi-thit-nuong',
            name: 'Bánh mì thịt nướng',
            description: 'Grilled pork, pickled carrot and daikon, herbs.',
            amountMinor: 35000,
            image: '/images/dishes/ben-thanh-banh-mi-thit-nuong.svg',
          },
          {
            id: 'ben-thanh-banh-mi-op-la',
            name: 'Bánh mì ốp la',
            description: 'Fried egg, pâté, chả lụa.',
            amountMinor: 30000,
            image: '/images/dishes/ben-thanh-banh-mi-op-la.svg',
          },
        ],
      },
      {
        title: 'Drinks',
        items: [
          {
            id: 'ben-thanh-banh-mi-ca-phe-sua-da',
            name: 'Cà phê sữa đá',
            description: 'Iced Vietnamese coffee, condensed milk.',
            amountMinor: 25000,
            image: '/images/dishes/ben-thanh-banh-mi-ca-phe-sua-da.svg',
          },
          {
            id: 'ben-thanh-banh-mi-tra-da',
            name: 'Trà đá',
            description: 'Iced green tea.',
            amountMinor: 10000,
            image: '/images/dishes/ben-thanh-banh-mi-tra-da.svg',
          },
        ],
      },
    ],
  },
  {
    slug: 'saigon-pho-quan',
    name: 'Sài Gòn Phở Quán',
    city: 'hcmc',
    cuisineTag: 'Phở',
    rating: 4.7,
    etaMinMinutes: 25,
    etaMaxMinutes: 35,
    deliveryFeeMinor: 15000,
    hasDeal: false,
    heroImage: '/images/restaurants/saigon-pho-quan-hero.svg',
    menu: [
      {
        title: 'Phở',
        items: [
          {
            id: 'saigon-pho-quan-bo',
            name: 'Phở bò',
            description: 'Beef noodle soup, herbs, bean sprouts.',
            amountMinor: 55000,
            image: '/images/dishes/saigon-pho-quan-bo.svg',
          },
          {
            id: 'saigon-pho-quan-ga',
            name: 'Phở gà',
            description: 'Chicken noodle soup, herbs, lime.',
            amountMinor: 50000,
            image: '/images/dishes/saigon-pho-quan-ga.svg',
          },
        ],
      },
      {
        title: 'Starters',
        items: [
          {
            id: 'saigon-pho-quan-goi-cuon',
            name: 'Gỏi cuốn',
            description: 'Fresh spring rolls, shrimp, herbs, peanut sauce.',
            amountMinor: 40000,
            image: '/images/dishes/saigon-pho-quan-goi-cuon.svg',
          },
          {
            id: 'saigon-pho-quan-cha-gio',
            name: 'Chả giò',
            description: 'Fried spring rolls, pork and vegetable.',
            amountMinor: 45000,
            image: '/images/dishes/saigon-pho-quan-cha-gio.svg',
          },
        ],
      },
    ],
  },
  {
    slug: 'com-tam-quan-nha',
    name: 'Cơm Tấm Quán Nhà',
    city: 'hcmc',
    cuisineTag: 'Cơm',
    rating: 4.5,
    etaMinMinutes: 20,
    etaMaxMinutes: 30,
    deliveryFeeMinor: 12000,
    hasDeal: false,
    heroImage: '/images/restaurants/com-tam-quan-nha-hero.svg',
    menu: [
      {
        title: 'Cơm tấm',
        items: [
          {
            id: 'com-tam-quan-nha-suon-nuong',
            name: 'Cơm tấm sườn nướng',
            description: 'Broken rice, grilled pork chop, pickles.',
            amountMinor: 45000,
            image: '/images/dishes/com-tam-quan-nha-suon-nuong.svg',
          },
          {
            id: 'com-tam-quan-nha-bi-cha',
            name: 'Cơm tấm bì chả',
            description: 'Broken rice, shredded pork skin, egg cake.',
            amountMinor: 42000,
            image: '/images/dishes/com-tam-quan-nha-bi-cha.svg',
          },
        ],
      },
      {
        title: 'Drinks',
        items: [
          {
            id: 'com-tam-quan-nha-nuoc-mia',
            name: 'Nước mía',
            description: 'Fresh sugarcane juice, over ice.',
            amountMinor: 18000,
            image: '/images/dishes/com-tam-quan-nha-nuoc-mia.svg',
          },
          {
            id: 'com-tam-quan-nha-sam-lanh',
            name: 'Sâm lạnh',
            description: 'Chilled herbal tea.',
            amountMinor: 15000,
            image: '/images/dishes/com-tam-quan-nha-sam-lanh.svg',
          },
        ],
      },
    ],
  },
];

export const RESTAURANTS_BY_CITY: Record<City, Restaurant[]> = {
  sf: SF_RESTAURANTS,
  hcmc: HCMC_RESTAURANTS,
};

export const ALL_RESTAURANTS: Restaurant[] = [...SF_RESTAURANTS, ...HCMC_RESTAURANTS];

export function restaurantsForCity(city: City): Restaurant[] {
  return RESTAURANTS_BY_CITY[city];
}

export function getRestaurant(slug: string): Restaurant | undefined {
  return ALL_RESTAURANTS.find((restaurant) => restaurant.slug === slug);
}

export function getMenuItem(itemId: string): { restaurant: Restaurant; item: MenuItem } | undefined {
  for (const restaurant of ALL_RESTAURANTS) {
    for (const section of restaurant.menu) {
      const item = section.items.find((candidate) => candidate.id === itemId);
      if (item) return { restaurant, item };
    }
  }
  return undefined;
}

export const CUISINE_SHORTCUTS: Record<City, string[]> = {
  sf: ['Tacos', 'Pizza', 'Dim sum', 'Bowls'],
  hcmc: ['Phở', 'Bánh mì', 'Cơm', 'Bún'],
};
