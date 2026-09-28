// Fixed, compile-time restaurant/menu content for SF and HCMC (LA's is
// catalogue-la.ts, #233) — docs/design/
// 80-two-city-brand-and-flow.md, "Home feed" and "Restaurant" screens, and
// its own "guesses" section: plausible, licensable-photo-backed rosters, not
// the only valid set. Replaces the parody catalogue
// (docs/design/65-parody-flow.md / 72-dontdropthatpromo-identity.md) in
// full — no restaurant or dish name below is a real chain's.
//
// Every photo path here is a real, licence-clean download fetched through
// docs/design/photos.json (#106) — see docs/design/80-photo-credits.md for
// the photographer credit and licence per file.

import type { City, Currency } from './money';
import { CITIES, currencyForCity } from './money';
import { HCMC_MORE, SF_MORE } from './catalogue-more';
import { LA_RESTAURANTS } from './catalogue-la';

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
  /** Fixed alongside `rating` (#130, parent #129) — a plausible, varied count, formatted by reviews.ts's `formatReviewCount`. */
  reviewCount: number;
  /** 0 means the fee shows as "Free" — no deal makes any fee 0 in this catalogue yet (#87's job). */
  deliveryFeeMinor: number;
  hasDeal: boolean;
  heroImage: string;
  menu: MenuSection[];
}

export function currencyForRestaurant(restaurant: Restaurant): Currency {
  return currencyForCity(restaurant.city);
}

const SF_RESTAURANTS: Restaurant[] = [
  {
    slug: 'mission-taqueria',
    name: 'Mission Taqueria',
    city: 'sf',
    cuisineTag: 'Tacos',
    rating: 4.6,
    reviewCount: 1247,
    deliveryFeeMinor: 199,
    hasDeal: true,
    heroImage: '/images/restaurants/mission-taqueria-hero.jpg',
    menu: [
      {
        title: 'Tacos',
        items: [
          {
            id: 'mission-taqueria-al-pastor',
            name: 'Al pastor taco',
            description: 'Marinated pork, pineapple, cilantro, onion.',
            amountMinor: 425,
            image: '/images/dishes/mission-taqueria-al-pastor.jpg',
          },
          {
            id: 'mission-taqueria-carne-asada',
            name: 'Carne asada taco',
            description: 'Grilled steak, salsa verde, lime.',
            amountMinor: 475,
            image: '/images/dishes/mission-taqueria-carne-asada.jpg',
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
            image: '/images/dishes/mission-taqueria-chips-guac.jpg',
          },
          {
            id: 'mission-taqueria-horchata',
            name: 'Horchata',
            description: 'Rice and cinnamon, served cold.',
            amountMinor: 400,
            image: '/images/dishes/mission-taqueria-horchata.jpg',
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
    reviewCount: 683,
    deliveryFeeMinor: 299,
    hasDeal: false,
    heroImage: '/images/restaurants/north-beach-pizzeria-hero.jpg',
    menu: [
      {
        title: 'Pizza',
        items: [
          {
            id: 'north-beach-pizzeria-margherita',
            name: 'Margherita',
            description: 'San Marzano tomato, mozzarella, basil.',
            amountMinor: 1650,
            image: '/images/dishes/north-beach-pizzeria-margherita.jpg',
          },
          {
            id: 'north-beach-pizzeria-pepperoni',
            name: 'Pepperoni',
            description: 'Mozzarella, cup-and-char pepperoni.',
            amountMinor: 1850,
            image: '/images/dishes/north-beach-pizzeria-pepperoni.jpg',
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
            image: '/images/dishes/north-beach-pizzeria-garlic-knots.jpg',
          },
          {
            id: 'north-beach-pizzeria-caesar',
            name: 'Caesar salad',
            description: 'Romaine, shaved parmesan, croutons.',
            amountMinor: 950,
            image: '/images/dishes/north-beach-pizzeria-caesar.jpg',
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
    reviewCount: 2103,
    deliveryFeeMinor: 249,
    hasDeal: false,
    heroImage: '/images/restaurants/golden-lotus-dim-sum-hero.jpg',
    menu: [
      {
        title: 'Steamed',
        items: [
          {
            id: 'golden-lotus-dim-sum-har-gow',
            name: 'Har gow',
            description: 'Shrimp dumplings, bamboo steamer.',
            amountMinor: 895,
            image: '/images/dishes/golden-lotus-dim-sum-har-gow.jpg',
          },
          {
            id: 'golden-lotus-dim-sum-siu-mai',
            name: 'Siu mai',
            description: 'Pork and shrimp dumplings.',
            amountMinor: 850,
            image: '/images/dishes/golden-lotus-dim-sum-siu-mai.jpg',
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
            image: '/images/dishes/golden-lotus-dim-sum-congee.jpg',
          },
          {
            id: 'golden-lotus-dim-sum-noodles',
            name: 'Rice noodle rolls',
            description: 'Soy-glazed, sesame, scallion.',
            amountMinor: 825,
            image: '/images/dishes/golden-lotus-dim-sum-noodles.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'bay-grain-bowls',
    name: 'Bay Grain Bowls',
    city: 'sf',
    cuisineTag: 'Bowls',
    rating: 4.7,
    reviewCount: 954,
    deliveryFeeMinor: 99,
    hasDeal: false,
    heroImage: '/images/restaurants/bay-grain-bowls-hero.jpg',
    menu: [
      {
        title: 'Bowls',
        items: [
          {
            id: 'bay-grain-bowls-teriyaki-chicken',
            name: 'Teriyaki chicken bowl',
            description: 'Grilled chicken, brown rice, seasonal veg.',
            amountMinor: 1350,
            image: '/images/dishes/bay-grain-bowls-teriyaki-chicken.jpg',
          },
          {
            id: 'bay-grain-bowls-tofu-poke',
            name: 'Tofu poke bowl',
            description: 'Marinated tofu, edamame, pickled ginger.',
            amountMinor: 1250,
            image: '/images/dishes/bay-grain-bowls-tofu-poke.jpg',
          },
        ],
      },
      {
        title: 'Sides',
        items: [
          {
            id: 'bay-grain-bowls-miso-soup',
            name: 'Miso soup',
            description: 'Traditional miso broth, scallion, tofu.',
            amountMinor: 350,
            image: '/images/dishes/bay-grain-bowls-miso-soup.jpg',
          },
          {
            id: 'bay-grain-bowls-iced-green-tea',
            name: 'Iced green tea',
            description: 'Unsweetened, brewed daily.',
            amountMinor: 300,
            image: '/images/dishes/bay-grain-bowls-iced-green-tea.jpg',
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
    reviewCount: 3821,
    deliveryFeeMinor: 10000,
    hasDeal: true,
    heroImage: '/images/restaurants/ben-thanh-banh-mi-hero.jpg',
    menu: [
      {
        title: 'Bánh mì',
        items: [
          {
            id: 'ben-thanh-banh-mi-thit-nuong',
            name: 'Bánh mì thịt nướng',
            description: 'Grilled pork, pickled carrot and daikon, herbs.',
            amountMinor: 35000,
            image: '/images/dishes/ben-thanh-banh-mi-thit-nuong.jpg',
          },
          {
            id: 'ben-thanh-banh-mi-op-la',
            name: 'Bánh mì ốp la',
            description: 'Fried egg, pâté, chả lụa.',
            amountMinor: 30000,
            image: '/images/dishes/ben-thanh-banh-mi-op-la.jpg',
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
            image: '/images/dishes/ben-thanh-banh-mi-ca-phe-sua-da.jpg',
          },
          {
            id: 'ben-thanh-banh-mi-tra-da',
            name: 'Trà đá',
            description: 'Iced green tea.',
            amountMinor: 10000,
            image: '/images/dishes/ben-thanh-banh-mi-tra-da.jpg',
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
    reviewCount: 1560,
    deliveryFeeMinor: 15000,
    hasDeal: false,
    heroImage: '/images/restaurants/saigon-pho-quan-hero.jpg',
    menu: [
      {
        title: 'Phở',
        items: [
          {
            id: 'saigon-pho-quan-bo',
            name: 'Phở bò',
            description: 'Beef noodle soup, herbs, bean sprouts.',
            amountMinor: 55000,
            image: '/images/dishes/saigon-pho-quan-bo.jpg',
          },
          {
            id: 'saigon-pho-quan-ga',
            name: 'Phở gà',
            description: 'Chicken noodle soup, herbs, lime.',
            amountMinor: 50000,
            image: '/images/dishes/saigon-pho-quan-ga.jpg',
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
            image: '/images/dishes/saigon-pho-quan-goi-cuon.jpg',
          },
          {
            id: 'saigon-pho-quan-cha-gio',
            name: 'Chả giò',
            description: 'Fried spring rolls, pork and vegetable.',
            amountMinor: 45000,
            image: '/images/dishes/saigon-pho-quan-cha-gio.jpg',
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
    reviewCount: 742,
    deliveryFeeMinor: 12000,
    hasDeal: false,
    heroImage: '/images/restaurants/com-tam-quan-nha-hero.jpg',
    menu: [
      {
        title: 'Cơm tấm',
        items: [
          {
            id: 'com-tam-quan-nha-suon-nuong',
            name: 'Cơm tấm sườn nướng',
            description: 'Broken rice, grilled pork chop, pickles.',
            amountMinor: 45000,
            image: '/images/dishes/com-tam-quan-nha-suon-nuong.jpg',
          },
          {
            id: 'com-tam-quan-nha-bi-cha',
            name: 'Cơm tấm bì chả',
            description: 'Broken rice, shredded pork skin, egg cake.',
            amountMinor: 42000,
            image: '/images/dishes/com-tam-quan-nha-bi-cha.jpg',
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
            image: '/images/dishes/com-tam-quan-nha-nuoc-mia.jpg',
          },
          {
            id: 'com-tam-quan-nha-sam-lanh',
            name: 'Sâm lạnh',
            description: 'Chilled herbal tea.',
            amountMinor: 15000,
            image: '/images/dishes/com-tam-quan-nha-sam-lanh.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'bun-cha-co-ba',
    name: 'Bún Chả Cô Ba',
    city: 'hcmc',
    cuisineTag: 'Bún',
    rating: 4.6,
    reviewCount: 1899,
    deliveryFeeMinor: 12000,
    hasDeal: false,
    heroImage: '/images/restaurants/bun-cha-co-ba-hero.jpg',
    menu: [
      {
        title: 'Bún',
        items: [
          {
            id: 'bun-cha-co-ba-bun-cha-ha-noi',
            name: 'Bún chả Hà Nội',
            description: 'Grilled pork patties, rice vermicelli, herbs, dipping sauce.',
            amountMinor: 45000,
            image: '/images/dishes/bun-cha-co-ba-bun-cha-ha-noi.jpg',
          },
          {
            id: 'bun-cha-co-ba-bun-bo-hue',
            name: 'Bún bò Huế',
            description: 'Spicy beef and pork noodle soup, lemongrass.',
            amountMinor: 50000,
            image: '/images/dishes/bun-cha-co-ba-bun-bo-hue.jpg',
          },
        ],
      },
      {
        title: 'Drinks',
        items: [
          {
            id: 'bun-cha-co-ba-tra-chanh',
            name: 'Trà chanh',
            description: 'Iced lemon tea.',
            amountMinor: 15000,
            image: '/images/dishes/bun-cha-co-ba-tra-chanh.jpg',
          },
          {
            id: 'bun-cha-co-ba-sinh-to-bo',
            name: 'Sinh tố bơ',
            description: 'Avocado smoothie.',
            amountMinor: 25000,
            image: '/images/dishes/bun-cha-co-ba-sinh-to-bo.jpg',
          },
        ],
      },
    ],
  },
];

// The first four per city are the ones #80's mocks and the home feed's
// first screen are designed around; catalogue-more.ts carries the rest.
// LA's 14 are all in catalogue-la.ts (docs/design/229-la-catalogue.md, #233).
export const RESTAURANTS_BY_CITY: Record<City, Restaurant[]> = {
  sf: [...SF_RESTAURANTS, ...SF_MORE],
  hcmc: [...HCMC_RESTAURANTS, ...HCMC_MORE],
  la: [...LA_RESTAURANTS],
};

export const ALL_RESTAURANTS: Restaurant[] = CITIES.flatMap((city) => RESTAURANTS_BY_CITY[city]);

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
  sf: ['Tacos', 'Pizza', 'Dim sum', 'Bowls', 'Burgers', 'Thai', 'Sushi', 'Indian', 'Mediterranean', 'Korean', 'Ramen', 'Breakfast', 'Vegan', 'Seafood'],
  hcmc: ['Phở', 'Bánh mì', 'Cơm', 'Bún', 'Hủ tiếu', 'Gỏi cuốn', 'Lẩu', 'Cà phê', 'Chè', 'Cơm gà', 'Hải sản', 'Bánh xèo', 'Mì Quảng', 'Bò bít tết'],
  la: ['Tacos', 'Korean BBQ', 'Thai', 'Armenian', 'Smoothie bowls', 'Ramen', 'Filipino', 'Poke', 'Breakfast', 'Hand rolls', 'Soul food', 'Persian', 'Deli', 'Vegan'],
};
