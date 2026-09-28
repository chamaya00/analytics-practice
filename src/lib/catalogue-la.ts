// Los Angeles's catalogue: 14 restaurants and 70 dishes, exactly
// docs/design/229-la-catalogue.md's (#229, built by #233). Same rules as
// restaurants.ts and catalogue-more.ts: invented names, no real chain's,
// prices in USD cents, every image a real, licence-clean download fetched
// through docs/design/photos.json (#231) - see docs/design/80-photo-credits.md
// for credits.

import type { Restaurant } from './restaurants';

export const LA_RESTAURANTS: Restaurant[] = [
  {
    slug: 'boyle-heights-taco-window',
    name: 'Boyle Heights Taco Window',
    city: 'la',
    cuisineTag: 'Tacos',
    rating: 4.7,
    reviewCount: 1583,
    deliveryFeeMinor: 199,
    hasDeal: true,
    heroImage: '/images/restaurants/boyle-heights-taco-window-hero.jpg',
    menu: [
      {
        title: 'Tacos',
        items: [
          {
            id: 'boyle-heights-taco-window-birria-tacos',
            name: 'Birria tacos',
            description: 'Three beef birria tacos, melted cheese, a cup of consommé.',
            amountMinor: 1395,
            image: '/images/dishes/boyle-heights-taco-window-birria-tacos.jpg',
          },
          {
            id: 'boyle-heights-taco-window-carnitas-taco',
            name: 'Carnitas taco',
            description: 'Slow-cooked pork, onion, cilantro, salsa roja.',
            amountMinor: 450,
            image: '/images/dishes/boyle-heights-taco-window-carnitas-taco.jpg',
          },
          {
            id: 'boyle-heights-taco-window-nopales-taco',
            name: 'Nopales taco',
            description: 'Grilled cactus, queso fresco, pico de gallo.',
            amountMinor: 425,
            image: '/images/dishes/boyle-heights-taco-window-nopales-taco.jpg',
          },
        ],
      },
      {
        title: 'Sides & drinks',
        items: [
          {
            id: 'boyle-heights-taco-window-elote',
            name: 'Elote',
            description: 'Grilled corn, mayo, cotija, chile, lime.',
            amountMinor: 550,
            image: '/images/dishes/boyle-heights-taco-window-elote.jpg',
          },
          {
            id: 'boyle-heights-taco-window-agua-de-jamaica',
            name: 'Agua de jamaica',
            description: 'Hibiscus iced tea, lightly sweet.',
            amountMinor: 400,
            image: '/images/dishes/boyle-heights-taco-window-agua-de-jamaica.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'koreatown-charcoal-house',
    name: 'Koreatown Charcoal House',
    city: 'la',
    cuisineTag: 'Korean BBQ',
    rating: 4.8,
    reviewCount: 2876,
    deliveryFeeMinor: 299,
    hasDeal: true,
    heroImage: '/images/restaurants/koreatown-charcoal-house-hero.jpg',
    menu: [
      {
        title: 'From the grill',
        items: [
          {
            id: 'koreatown-charcoal-house-galbi-plate',
            name: 'Galbi plate',
            description: 'Marinated beef short rib, rice, banchan.',
            amountMinor: 2695,
            image: '/images/dishes/koreatown-charcoal-house-galbi-plate.jpg',
          },
          {
            id: 'koreatown-charcoal-house-pork-belly-set',
            name: 'Pork belly set',
            description: 'Grilled pork belly, lettuce wraps, ssamjang.',
            amountMinor: 2395,
            image: '/images/dishes/koreatown-charcoal-house-pork-belly-set.jpg',
          },
          {
            id: 'koreatown-charcoal-house-kimchi-fried-rice',
            name: 'Kimchi fried rice',
            description: 'Kimchi, pork, fried egg, sesame.',
            amountMinor: 1595,
            image: '/images/dishes/koreatown-charcoal-house-kimchi-fried-rice.jpg',
          },
        ],
      },
      {
        title: 'Sides',
        items: [
          {
            id: 'koreatown-charcoal-house-seafood-pancake',
            name: 'Seafood pancake',
            description: 'Scallion and squid pancake, soy dipping sauce.',
            amountMinor: 1695,
            image: '/images/dishes/koreatown-charcoal-house-seafood-pancake.jpg',
          },
          {
            id: 'koreatown-charcoal-house-corn-cheese',
            name: 'Corn cheese',
            description: 'Sweet corn baked under mozzarella.',
            amountMinor: 895,
            image: '/images/dishes/koreatown-charcoal-house-corn-cheese.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'thai-town-boat-noodle-house',
    name: 'Thai Town Boat Noodle House',
    city: 'la',
    cuisineTag: 'Thai',
    rating: 4.6,
    reviewCount: 1942,
    deliveryFeeMinor: 149,
    hasDeal: false,
    heroImage: '/images/restaurants/thai-town-boat-noodle-house-hero.jpg',
    menu: [
      {
        title: 'Noodles & rice',
        items: [
          {
            id: 'thai-town-boat-noodle-house-boat-noodle-soup',
            name: 'Boat noodle soup',
            description: 'Rich beef broth, rice noodles, morning glory.',
            amountMinor: 1450,
            image: '/images/dishes/thai-town-boat-noodle-house-boat-noodle-soup.jpg',
          },
          {
            id: 'thai-town-boat-noodle-house-pad-see-ew',
            name: 'Pad see ew',
            description: 'Wide rice noodles, Chinese broccoli, egg, chicken.',
            amountMinor: 1595,
            image: '/images/dishes/thai-town-boat-noodle-house-pad-see-ew.jpg',
          },
          {
            id: 'thai-town-boat-noodle-house-khao-man-gai',
            name: 'Khao man gai',
            description: 'Poached chicken, ginger rice, soybean sauce.',
            amountMinor: 1495,
            image: '/images/dishes/thai-town-boat-noodle-house-khao-man-gai.jpg',
          },
        ],
      },
      {
        title: 'Sides & drinks',
        items: [
          {
            id: 'thai-town-boat-noodle-house-papaya-salad',
            name: 'Papaya salad',
            description: 'Green papaya, lime, chile, peanuts.',
            amountMinor: 1150,
            image: '/images/dishes/thai-town-boat-noodle-house-papaya-salad.jpg',
          },
          {
            id: 'thai-town-boat-noodle-house-thai-iced-tea',
            name: 'Thai iced tea',
            description: 'Black tea, condensed milk, over ice.',
            amountMinor: 550,
            image: '/images/dishes/thai-town-boat-noodle-house-thai-iced-tea.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'glendale-lavash-bakery',
    name: 'Glendale Lavash Bakery',
    city: 'la',
    cuisineTag: 'Armenian',
    rating: 4.7,
    reviewCount: 1206,
    deliveryFeeMinor: 99,
    hasDeal: true,
    heroImage: '/images/restaurants/glendale-lavash-bakery-hero.jpg',
    menu: [
      {
        title: 'Bakery',
        items: [
          {
            id: 'glendale-lavash-bakery-lahmajun',
            name: 'Lahmajun',
            description: 'Thin flatbread, spiced minced beef, parsley, lemon.',
            amountMinor: 650,
            image: '/images/dishes/glendale-lavash-bakery-lahmajun.jpg',
          },
          {
            id: 'glendale-lavash-bakery-cheese-boereg',
            name: 'Cheese boereg',
            description: 'Flaky pastry layered with three cheeses.',
            amountMinor: 525,
            image: '/images/dishes/glendale-lavash-bakery-cheese-boereg.jpg',
          },
          {
            id: 'glendale-lavash-bakery-pakhlava',
            name: 'Pakhlava',
            description: 'Walnut and honey pastry, two pieces.',
            amountMinor: 450,
            image: '/images/dishes/glendale-lavash-bakery-pakhlava.jpg',
          },
        ],
      },
      {
        title: 'Plates',
        items: [
          {
            id: 'glendale-lavash-bakery-chicken-shawarma-plate',
            name: 'Chicken shawarma plate',
            description: 'Rice pilaf, garlic sauce, pickles, lavash.',
            amountMinor: 1795,
            image: '/images/dishes/glendale-lavash-bakery-chicken-shawarma-plate.jpg',
          },
          {
            id: 'glendale-lavash-bakery-lule-kebab-plate',
            name: 'Lule kebab plate',
            description: 'Two ground beef kebabs, grilled tomato, bulgur.',
            amountMinor: 1895,
            image: '/images/dishes/glendale-lavash-bakery-lule-kebab-plate.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'venice-boardwalk-bowls',
    name: 'Venice Boardwalk Bowls',
    city: 'la',
    cuisineTag: 'Smoothie bowls',
    rating: 4.5,
    reviewCount: 734,
    deliveryFeeMinor: 199,
    hasDeal: false,
    heroImage: '/images/restaurants/venice-boardwalk-bowls-hero.jpg',
    menu: [
      {
        title: 'Bowls',
        items: [
          {
            id: 'venice-boardwalk-bowls-acai-bowl',
            name: 'Açaí bowl',
            description: 'Açaí, banana, granola, strawberries, honey.',
            amountMinor: 1395,
            image: '/images/dishes/venice-boardwalk-bowls-acai-bowl.jpg',
          },
          {
            id: 'venice-boardwalk-bowls-pitaya-bowl',
            name: 'Pitaya bowl',
            description: 'Pink dragon fruit, mango, coconut, chia.',
            amountMinor: 1450,
            image: '/images/dishes/venice-boardwalk-bowls-pitaya-bowl.jpg',
          },
          {
            id: 'venice-boardwalk-bowls-avocado-toast',
            name: 'Avocado toast',
            description: 'Sourdough, smashed avocado, chile flakes, lemon.',
            amountMinor: 1250,
            image: '/images/dishes/venice-boardwalk-bowls-avocado-toast.jpg',
          },
        ],
      },
      {
        title: 'Smoothies',
        items: [
          {
            id: 'venice-boardwalk-bowls-peanut-butter-banana-smoothie',
            name: 'Peanut butter banana smoothie',
            description: 'Banana, peanut butter, oat milk, dates.',
            amountMinor: 1095,
            image: '/images/dishes/venice-boardwalk-bowls-peanut-butter-banana-smoothie.jpg',
          },
          {
            id: 'venice-boardwalk-bowls-green-smoothie',
            name: 'Green smoothie',
            description: 'Spinach, pineapple, apple, ginger.',
            amountMinor: 1050,
            image: '/images/dishes/venice-boardwalk-bowls-green-smoothie.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'sawtelle-tonkotsu-bar',
    name: 'Sawtelle Tonkotsu Bar',
    city: 'la',
    cuisineTag: 'Ramen',
    rating: 4.7,
    reviewCount: 2214,
    deliveryFeeMinor: 249,
    hasDeal: false,
    heroImage: '/images/restaurants/sawtelle-tonkotsu-bar-hero.jpg',
    menu: [
      {
        title: 'Ramen',
        items: [
          {
            id: 'sawtelle-tonkotsu-bar-tonkotsu-ramen',
            name: 'Tonkotsu ramen',
            description: 'Pork bone broth, chashu, soft egg, scallion.',
            amountMinor: 1795,
            image: '/images/dishes/sawtelle-tonkotsu-bar-tonkotsu-ramen.jpg',
          },
          {
            id: 'sawtelle-tonkotsu-bar-spicy-miso-ramen',
            name: 'Spicy miso ramen',
            description: 'Miso broth, chile oil, ground pork, corn.',
            amountMinor: 1850,
            image: '/images/dishes/sawtelle-tonkotsu-bar-spicy-miso-ramen.jpg',
          },
          {
            id: 'sawtelle-tonkotsu-bar-tsukemen',
            name: 'Tsukemen',
            description: 'Thick dipping noodles, rich fish and pork broth.',
            amountMinor: 1895,
            image: '/images/dishes/sawtelle-tonkotsu-bar-tsukemen.jpg',
          },
        ],
      },
      {
        title: 'Sides',
        items: [
          {
            id: 'sawtelle-tonkotsu-bar-gyoza',
            name: 'Gyoza',
            description: 'Six pan-fried pork dumplings.',
            amountMinor: 795,
            image: '/images/dishes/sawtelle-tonkotsu-bar-gyoza.jpg',
          },
          {
            id: 'sawtelle-tonkotsu-bar-chashu-rice-bowl',
            name: 'Chashu rice bowl',
            description: 'Torched pork belly over rice, mayo, scallion.',
            amountMinor: 895,
            image: '/images/dishes/sawtelle-tonkotsu-bar-chashu-rice-bowl.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'temple-street-filipino-kitchen',
    name: 'Temple Street Filipino Kitchen',
    city: 'la',
    cuisineTag: 'Filipino',
    rating: 4.6,
    reviewCount: 988,
    deliveryFeeMinor: 199,
    hasDeal: true,
    heroImage: '/images/restaurants/temple-street-filipino-kitchen-hero.jpg',
    menu: [
      {
        title: 'Mains',
        items: [
          {
            id: 'temple-street-filipino-kitchen-chicken-adobo',
            name: 'Chicken adobo',
            description: 'Braised in vinegar, soy, garlic and bay; garlic rice.',
            amountMinor: 1650,
            image: '/images/dishes/temple-street-filipino-kitchen-chicken-adobo.jpg',
          },
          {
            id: 'temple-street-filipino-kitchen-pork-sisig',
            name: 'Pork sisig',
            description: 'Sizzling chopped pork, onion, chile, egg.',
            amountMinor: 1795,
            image: '/images/dishes/temple-street-filipino-kitchen-pork-sisig.jpg',
          },
          {
            id: 'temple-street-filipino-kitchen-pancit-bihon',
            name: 'Pancit bihon',
            description: 'Rice noodles, chicken, cabbage, carrot, calamansi.',
            amountMinor: 1495,
            image: '/images/dishes/temple-street-filipino-kitchen-pancit-bihon.jpg',
          },
        ],
      },
      {
        title: 'Sides & dessert',
        items: [
          {
            id: 'temple-street-filipino-kitchen-lumpia-shanghai',
            name: 'Lumpia shanghai',
            description: 'Ten crisp pork spring rolls, sweet chile sauce.',
            amountMinor: 895,
            image: '/images/dishes/temple-street-filipino-kitchen-lumpia-shanghai.jpg',
          },
          {
            id: 'temple-street-filipino-kitchen-ube-halo-halo',
            name: 'Ube halo-halo',
            description: 'Shaved ice, ube, leche flan, sweet beans.',
            amountMinor: 850,
            image: '/images/dishes/temple-street-filipino-kitchen-ube-halo-halo.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'silver-lake-poke-counter',
    name: 'Silver Lake Poke Counter',
    city: 'la',
    cuisineTag: 'Poke',
    rating: 4.5,
    reviewCount: 647,
    deliveryFeeMinor: 149,
    hasDeal: false,
    heroImage: '/images/restaurants/silver-lake-poke-counter-hero.jpg',
    menu: [
      {
        title: 'Bowls',
        items: [
          {
            id: 'silver-lake-poke-counter-classic-ahi-poke-bowl',
            name: 'Classic ahi poke bowl',
            description: 'Ahi tuna, shoyu, sweet onion, seaweed, rice.',
            amountMinor: 1695,
            image: '/images/dishes/silver-lake-poke-counter-classic-ahi-poke-bowl.jpg',
          },
          {
            id: 'silver-lake-poke-counter-spicy-salmon-poke-bowl',
            name: 'Spicy salmon poke bowl',
            description: 'Salmon, spicy mayo, cucumber, avocado, rice.',
            amountMinor: 1650,
            image: '/images/dishes/silver-lake-poke-counter-spicy-salmon-poke-bowl.jpg',
          },
          {
            id: 'silver-lake-poke-counter-tofu-poke-bowl',
            name: 'Tofu poke bowl',
            description: 'Marinated tofu, edamame, mango, brown rice.',
            amountMinor: 1395,
            image: '/images/dishes/silver-lake-poke-counter-tofu-poke-bowl.jpg',
          },
        ],
      },
      {
        title: 'Sides',
        items: [
          {
            id: 'silver-lake-poke-counter-spam-musubi',
            name: 'Spam musubi',
            description: 'Seared Spam, rice, nori, teriyaki glaze.',
            amountMinor: 450,
            image: '/images/dishes/silver-lake-poke-counter-spam-musubi.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'echo-park-breakfast-burritos',
    name: 'Echo Park Breakfast Burritos',
    city: 'la',
    cuisineTag: 'Breakfast',
    rating: 4.6,
    reviewCount: 1377,
    deliveryFeeMinor: 0,
    hasDeal: false,
    heroImage: '/images/restaurants/echo-park-breakfast-burritos-hero.jpg',
    menu: [
      {
        title: 'Burritos',
        items: [
          {
            id: 'echo-park-breakfast-burritos-bacon-breakfast-burrito',
            name: 'Bacon breakfast burrito',
            description: 'Eggs, bacon, potatoes, cheddar, salsa roja.',
            amountMinor: 1250,
            image: '/images/dishes/echo-park-breakfast-burritos-bacon-breakfast-burrito.jpg',
          },
          {
            id: 'echo-park-breakfast-burritos-chorizo-breakfast-burrito',
            name: 'Chorizo breakfast burrito',
            description: 'Eggs, chorizo, potatoes, jack cheese.',
            amountMinor: 1295,
            image: '/images/dishes/echo-park-breakfast-burritos-chorizo-breakfast-burrito.jpg',
          },
          {
            id: 'echo-park-breakfast-burritos-veggie-breakfast-burrito',
            name: 'Veggie breakfast burrito',
            description: 'Eggs, black beans, peppers, avocado.',
            amountMinor: 1150,
            image: '/images/dishes/echo-park-breakfast-burritos-veggie-breakfast-burrito.jpg',
          },
        ],
      },
      {
        title: 'Plates & drinks',
        items: [
          {
            id: 'echo-park-breakfast-burritos-chilaquiles',
            name: 'Chilaquiles',
            description: 'Tortilla chips in salsa verde, fried egg, crema.',
            amountMinor: 1395,
            image: '/images/dishes/echo-park-breakfast-burritos-chilaquiles.jpg',
          },
          {
            id: 'echo-park-breakfast-burritos-cafe-de-olla',
            name: 'Café de olla',
            description: 'Coffee with cinnamon and piloncillo.',
            amountMinor: 450,
            image: '/images/dishes/echo-park-breakfast-burritos-cafe-de-olla.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'little-tokyo-hand-roll-bar',
    name: 'Little Tokyo Hand Roll Bar',
    city: 'la',
    cuisineTag: 'Hand rolls',
    rating: 4.8,
    reviewCount: 2641,
    deliveryFeeMinor: 249,
    hasDeal: false,
    heroImage: '/images/restaurants/little-tokyo-hand-roll-bar-hero.jpg',
    menu: [
      {
        title: 'Hand rolls',
        items: [
          {
            id: 'little-tokyo-hand-roll-bar-toro-hand-roll',
            name: 'Toro hand roll',
            description: 'Fatty tuna, scallion, crisp nori.',
            amountMinor: 895,
            image: '/images/dishes/little-tokyo-hand-roll-bar-toro-hand-roll.jpg',
          },
          {
            id: 'little-tokyo-hand-roll-bar-blue-crab-hand-roll',
            name: 'Blue crab hand roll',
            description: 'Blue crab, butter, rice, nori.',
            amountMinor: 795,
            image: '/images/dishes/little-tokyo-hand-roll-bar-blue-crab-hand-roll.jpg',
          },
          {
            id: 'little-tokyo-hand-roll-bar-salmon-hand-roll',
            name: 'Salmon hand roll',
            description: 'Salmon, sesame, rice, nori.',
            amountMinor: 695,
            image: '/images/dishes/little-tokyo-hand-roll-bar-salmon-hand-roll.jpg',
          },
          {
            id: 'little-tokyo-hand-roll-bar-yellowtail-hand-roll',
            name: 'Yellowtail hand roll',
            description: 'Yellowtail, scallion, rice, nori.',
            amountMinor: 750,
            image: '/images/dishes/little-tokyo-hand-roll-bar-yellowtail-hand-roll.jpg',
          },
        ],
      },
      {
        title: 'Sides',
        items: [
          {
            id: 'little-tokyo-hand-roll-bar-edamame',
            name: 'Edamame',
            description: 'Steamed, sea salt.',
            amountMinor: 450,
            image: '/images/dishes/little-tokyo-hand-roll-bar-edamame.jpg',
          },
          {
            id: 'little-tokyo-hand-roll-bar-miso-soup',
            name: 'Miso soup',
            description: 'Tofu, wakame, scallion.',
            amountMinor: 350,
            image: '/images/dishes/little-tokyo-hand-roll-bar-miso-soup.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'leimert-park-soul-kitchen',
    name: 'Leimert Park Soul Kitchen',
    city: 'la',
    cuisineTag: 'Soul food',
    rating: 4.7,
    reviewCount: 1129,
    deliveryFeeMinor: 199,
    hasDeal: false,
    heroImage: '/images/restaurants/leimert-park-soul-kitchen-hero.jpg',
    menu: [
      {
        title: 'Plates',
        items: [
          {
            id: 'leimert-park-soul-kitchen-chicken-and-waffles',
            name: 'Chicken and waffles',
            description: 'Fried chicken, buttermilk waffle, maple butter.',
            amountMinor: 1895,
            image: '/images/dishes/leimert-park-soul-kitchen-chicken-and-waffles.jpg',
          },
          {
            id: 'leimert-park-soul-kitchen-oxtail-plate',
            name: 'Oxtail plate',
            description: 'Braised oxtails, rice and gravy, cornbread.',
            amountMinor: 2495,
            image: '/images/dishes/leimert-park-soul-kitchen-oxtail-plate.jpg',
          },
        ],
      },
      {
        title: 'Sides & dessert',
        items: [
          {
            id: 'leimert-park-soul-kitchen-mac-and-cheese',
            name: 'Mac and cheese',
            description: 'Baked, three cheeses, crisp top.',
            amountMinor: 695,
            image: '/images/dishes/leimert-park-soul-kitchen-mac-and-cheese.jpg',
          },
          {
            id: 'leimert-park-soul-kitchen-collard-greens',
            name: 'Collard greens',
            description: 'Slow-cooked with smoked turkey.',
            amountMinor: 595,
            image: '/images/dishes/leimert-park-soul-kitchen-collard-greens.jpg',
          },
          {
            id: 'leimert-park-soul-kitchen-peach-cobbler',
            name: 'Peach cobbler',
            description: 'Warm peaches, buttery crust.',
            amountMinor: 650,
            image: '/images/dishes/leimert-park-soul-kitchen-peach-cobbler.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'westwood-persian-grill',
    name: 'Westwood Persian Grill',
    city: 'la',
    cuisineTag: 'Persian',
    rating: 4.6,
    reviewCount: 1468,
    deliveryFeeMinor: 249,
    hasDeal: false,
    heroImage: '/images/restaurants/westwood-persian-grill-hero.jpg',
    menu: [
      {
        title: 'Kebabs & stews',
        items: [
          {
            id: 'westwood-persian-grill-chicken-koobideh-plate',
            name: 'Chicken koobideh plate',
            description: 'Two ground chicken skewers, saffron rice, grilled tomato.',
            amountMinor: 1895,
            image: '/images/dishes/westwood-persian-grill-chicken-koobideh-plate.jpg',
          },
          {
            id: 'westwood-persian-grill-barg-kebab-plate',
            name: 'Barg kebab plate',
            description: 'Beef filet skewer, saffron rice, sumac.',
            amountMinor: 2595,
            image: '/images/dishes/westwood-persian-grill-barg-kebab-plate.jpg',
          },
          {
            id: 'westwood-persian-grill-ghormeh-sabzi',
            name: 'Ghormeh sabzi',
            description: 'Herb and kidney bean stew with beef, rice.',
            amountMinor: 1795,
            image: '/images/dishes/westwood-persian-grill-ghormeh-sabzi.jpg',
          },
        ],
      },
      {
        title: 'Sides & drinks',
        items: [
          {
            id: 'westwood-persian-grill-tahdig',
            name: 'Tahdig',
            description: 'Crisp saffron rice from the bottom of the pot.',
            amountMinor: 895,
            image: '/images/dishes/westwood-persian-grill-tahdig.jpg',
          },
          {
            id: 'westwood-persian-grill-doogh',
            name: 'Doogh',
            description: 'Salted yogurt drink with mint.',
            amountMinor: 450,
            image: '/images/dishes/westwood-persian-grill-doogh.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'fairfax-pastrami-deli',
    name: 'Fairfax Pastrami Deli',
    city: 'la',
    cuisineTag: 'Deli',
    rating: 4.5,
    reviewCount: 2033,
    deliveryFeeMinor: 199,
    hasDeal: true,
    heroImage: '/images/restaurants/fairfax-pastrami-deli-hero.jpg',
    menu: [
      {
        title: 'Sandwiches',
        items: [
          {
            id: 'fairfax-pastrami-deli-hot-pastrami-sandwich',
            name: 'Hot pastrami sandwich',
            description: 'Hand-cut pastrami on rye, mustard.',
            amountMinor: 1895,
            image: '/images/dishes/fairfax-pastrami-deli-hot-pastrami-sandwich.jpg',
          },
          {
            id: 'fairfax-pastrami-deli-reuben',
            name: 'Reuben',
            description: 'Corned beef, swiss, sauerkraut, Russian dressing.',
            amountMinor: 1795,
            image: '/images/dishes/fairfax-pastrami-deli-reuben.jpg',
          },
        ],
      },
      {
        title: 'Soups & sides',
        items: [
          {
            id: 'fairfax-pastrami-deli-matzo-ball-soup',
            name: 'Matzo ball soup',
            description: 'Chicken broth, carrots, dill.',
            amountMinor: 995,
            image: '/images/dishes/fairfax-pastrami-deli-matzo-ball-soup.jpg',
          },
          {
            id: 'fairfax-pastrami-deli-potato-latkes',
            name: 'Potato latkes',
            description: 'Three crisp latkes, applesauce, sour cream.',
            amountMinor: 795,
            image: '/images/dishes/fairfax-pastrami-deli-potato-latkes.jpg',
          },
          {
            id: 'fairfax-pastrami-deli-black-and-white-cookie',
            name: 'Black and white cookie',
            description: 'Soft cake cookie, half chocolate, half vanilla.',
            amountMinor: 450,
            image: '/images/dishes/fairfax-pastrami-deli-black-and-white-cookie.jpg',
          },
        ],
      },
    ],
  },
  {
    slug: 'los-feliz-plant-kitchen',
    name: 'Los Feliz Plant Kitchen',
    city: 'la',
    cuisineTag: 'Vegan',
    rating: 4.4,
    reviewCount: 612,
    deliveryFeeMinor: 0,
    hasDeal: false,
    heroImage: '/images/restaurants/los-feliz-plant-kitchen-hero.jpg',
    menu: [
      {
        title: 'Mains',
        items: [
          {
            id: 'los-feliz-plant-kitchen-jackfruit-tacos',
            name: 'Jackfruit tacos',
            description: 'Chile-braised jackfruit, cabbage, cashew crema.',
            amountMinor: 1395,
            image: '/images/dishes/los-feliz-plant-kitchen-jackfruit-tacos.jpg',
          },
          {
            id: 'los-feliz-plant-kitchen-mushroom-cheesesteak',
            name: 'Mushroom cheesesteak',
            description: 'Seared oyster mushrooms, cashew cheese, peppers.',
            amountMinor: 1595,
            image: '/images/dishes/los-feliz-plant-kitchen-mushroom-cheesesteak.jpg',
          },
          {
            id: 'los-feliz-plant-kitchen-kale-caesar',
            name: 'Kale caesar',
            description: 'Kale, capers, sourdough crumbs, cashew dressing.',
            amountMinor: 1295,
            image: '/images/dishes/los-feliz-plant-kitchen-kale-caesar.jpg',
          },
        ],
      },
      {
        title: 'Sides & drinks',
        items: [
          {
            id: 'los-feliz-plant-kitchen-buffalo-cauliflower',
            name: 'Buffalo cauliflower',
            description: 'Crisp cauliflower, buffalo sauce, ranch.',
            amountMinor: 1150,
            image: '/images/dishes/los-feliz-plant-kitchen-buffalo-cauliflower.jpg',
          },
          {
            id: 'los-feliz-plant-kitchen-oat-milk-horchata',
            name: 'Oat milk horchata',
            description: 'Rice, oat milk, cinnamon, over ice.',
            amountMinor: 595,
            image: '/images/dishes/los-feliz-plant-kitchen-oat-milk-horchata.jpg',
          },
        ],
      },
    ],
  },
];
