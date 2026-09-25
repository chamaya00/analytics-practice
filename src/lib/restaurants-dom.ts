// Restaurants screen (docs/design/65-parody-flow.md, screen 2): a fixed
// list, rendered entirely by the Astro template at build time. The only
// runtime behavior is firing the funnel event on load.

import { track } from './tracking';

export function initRestaurantsPage(): void {
  track('restaurants_viewed', {});
}
