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

// Round 1's redraw still read as a blocky squiggle at phone size (round 2
// review): the shapes only used the box's middle band, so a 1.2em icon still
// drew a tiny glyph. Round 2 uses the driver's own path data as-is — a
// scooter (rear body/seat, footboard, raked steering column and handlebar,
// two wheels) and a car (side profile with roofline, belt line, two wheels)
// — verified to read at 15px. `stroke-linecap`/`stroke-linejoin: round` now
// live on the `<svg>` wrapper (createVehicleIcon, below, and the restaurant
// page's inline svg) rather than per-path, since these paths don't set them.
export const VEHICLE_ICON_PATHS: Record<City, string> = {
  hcmc:
    '<circle cx="5.5" cy="17" r="2.5"/><circle cx="18.5" cy="17" r="2.5"/>' +
    '<path d="M3 14.5c0-2.5 1.7-3.5 4-3.5h4"/>' +
    '<path d="M8 17h6l2.5-11"/>' +
    '<path d="M14.5 5.5h3.5"/>',
  sf:
    '<circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>' +
    '<path d="M5 17H3v-4l2.5-1 2.5-4h8l3 4 2 1v4h-2"/>' +
    '<path d="M9 17h6"/>' +
    '<path d="M3 13h18"/>',
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
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-vehicle', vehicleForCity(city));
  svg.classList.add('vehicle-icon');
  svg.innerHTML = VEHICLE_ICON_PATHS[city];
  return svg;
}
