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

export const VEHICLE_ICON_PATHS: Record<City, string> = {
  hcmc: '<circle cx="5.5" cy="17" r="2.3"/><circle cx="18" cy="17" r="2.3"/><path d="M7.7 17h4.8l2-5h3.7M13 12 10.5 8H7" stroke-linecap="round" stroke-linejoin="round"/>',
  sf: '<path d="M4 16.5h1.3a2 2 0 0 0 4 0h5.4a2 2 0 0 0 4 0H20v-2.8l-2-4.2H8L4.5 13l-.5 1Z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>',
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
