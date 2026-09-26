// Money representation for the two-city catalogue — docs/design/
// 80-two-city-brand-and-flow.md, "Money, named for the engineer rather than
// solved here", and docs/measurement/81-two-city-event-contract.md §2.
// `priceCents` assumed a currency with a fractional minor unit; VND has none
// in ordinary use, so every amount here is carried as `amountMinor` (the
// contract's own term: cents for USD, whole đồng for VND) alongside the
// `currency` it belongs to, formatted only through `Intl.NumberFormat` so
// neither convention is hand-built.

export type City = 'sf' | 'hcmc';
export type Currency = 'USD' | 'VND';

export const CITIES: City[] = ['sf', 'hcmc'];

export const CITY_CURRENCY: Record<City, Currency> = {
  sf: 'USD',
  hcmc: 'VND',
};

const CITY_LOCALE: Record<City, string> = {
  sf: 'en-US',
  hcmc: 'vi-VN',
};

export const CITY_NAMES: Record<City, string> = {
  sf: 'San Francisco',
  hcmc: 'Ho Chi Minh City',
};

export function isCity(value: unknown): value is City {
  return value === 'sf' || value === 'hcmc';
}

export function currencyForCity(city: City): Currency {
  return CITY_CURRENCY[city];
}

/**
 * Formats a contract-shaped `amountMinor`/`currency` pair per its city's own
 * locale — `en-US`/`USD` for SF (`$21.50`), `vi-VN`/`VND` for HCMC
 * (`15.000 ₫`: dot thousands separator, no decimal part) — rather than a
 * hand-built string, so neither currency's convention is guessed at.
 */
export function formatMoney(amountMinor: number, currency: Currency): string {
  const city: City = currency === 'USD' ? 'sf' : 'hcmc';
  const value = currency === 'USD' ? amountMinor / 100 : amountMinor;
  return new Intl.NumberFormat(CITY_LOCALE[city], {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(value);
}

export function formatMoneyForCity(amountMinor: number, city: City): string {
  return formatMoney(amountMinor, currencyForCity(city));
}

/**
 * The checkout's fixed service fee, one value per currency — #80's checkout
 * mocks (`docs/design/80-checkout-{sf,hcmc}.html`) use $1.50 / ₫20.000, and
 * there is no per-restaurant service fee in the catalogue the way there is
 * a delivery fee, so this is the one figure the checkout breakdown supplies
 * itself rather than reading from `restaurants.ts`.
 */
export const SERVICE_FEE_MINOR: Record<Currency, number> = {
  USD: 150,
  VND: 20000,
};
