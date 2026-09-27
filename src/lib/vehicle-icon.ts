// The delivery-vehicle icon shown immediately before every "N min" estimate
// (#130, parent #129) — a motorbike for HCMC, a car for SF — drawn in the tab
// bar's own stroke style (Header.astro's TAB_ICON_PATHS wrapper: viewBox
// "0 0 24 24", stroke currentColor, stroke-width 2, aria-hidden).
//
// Used both from a DOM module (createVehicleIcon, below) and from the
// restaurant page's static template, which reads VEHICLE_ICON_PATHS directly
// via set:html the same way Header.astro does, since that page's vehicle
// depends only on the restaurant's own (statically known) city and doesn't
// need JS at all.

import type { City } from './money';

// Redrawn for the round 1 review (item 2): at the old 14px size the motorbike
// read as a squiggle and the car as a blob. Both are now drawn to read at
// ~16px — the scooter as two wheels, a low footboard, a raised seat and a
// front column with a handlebar; the car as a side profile with a
// window/roofline cut into the body, not a single unbroken silhouette.
export const VEHICLE_ICON_PATHS: Record<City, string> = {
  hcmc:
    '<circle cx="6" cy="18" r="2.2"/><circle cx="17.5" cy="18" r="2.2"/>' +
    '<path d="M6.5 17h3.5v-2.3h2.5v2.3h4.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M16.5 17v-4" stroke-linecap="round"/>' +
    '<path d="M15 13h3" stroke-linecap="round"/>',
  sf:
    '<path d="M5 16v-2.5l1.6-3.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.8 1l1.6 3.5V16" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M5 16h14" stroke-linecap="round"/>' +
    '<path d="M9 9.3 8 12h8l-1-2.7" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="7.5" cy="16.5" r="1.6"/><circle cx="16.5" cy="16.5" r="1.6"/>',
};

/** "motorbike" for HCMC, "car" for SF — the data-vehicle value a test asserts against rather than the raw path data (#130 AC4/AC5). */
export function vehicleForCity(city: City): 'motorbike' | 'car' {
  return city === 'hcmc' ? 'motorbike' : 'car';
}

/**
 * Builds one `<svg class="vehicle-icon">` matching the tab bar's markup
 * shape — used by every `*-dom.ts` render site, since each creates its own
 * DOM tree rather than sharing an Astro template.
 */
export function createVehicleIcon(city: City): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-vehicle', vehicleForCity(city));
  svg.classList.add('vehicle-icon');
  svg.innerHTML = VEHICLE_ICON_PATHS[city];
  return svg;
}
