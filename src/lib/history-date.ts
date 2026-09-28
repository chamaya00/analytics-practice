// A history row's date (#147, "History row"), per the order's own city —
// SF in 12-hour `en-US`, HCMC in 24-hour `vi-VN` — never the picker's
// current city (same rule #129/#130 set for the vehicle icon and #148
// applies to the driver): "Today, 12:18 PM" / "Today, 11:52"; "Yesterday";
// then "Tue, Sep 22" (SF) / "Tue, 22 Sep" (HCMC). Design doc's own guess,
// called out as such rather than a fixed spec.

import { CITY_LOCALE, type City } from './money';

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function formatHistoryDate(placedAt: string, city: City, now: number = Date.now()): string {
  const placedMs = new Date(placedAt).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(placedMs)) / 86_400_000);
  const locale = CITY_LOCALE[city];
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: city !== 'hcmc',
  }).format(placedMs);

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return 'Yesterday';

  return city === 'hcmc'
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(placedMs)
    : new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(placedMs);
}
