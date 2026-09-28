// Money representation for the two-city catalogue — docs/design/
// 80-two-city-brand-and-flow.md, "Money, named for the engineer rather than
// solved here", and docs/measurement/81-two-city-event-contract.md §2.
// `priceCents` assumed a currency with a fractional minor unit; VND has none
// in ordinary use, so every amount here is carried as `amountMinor` (the
// contract's own term: cents for USD, whole đồng for VND) alongside the
// `currency` it belongs to, formatted only through `Intl.NumberFormat` so
// neither convention is hand-built.
//
// #230: a currency no longer identifies a city. LA spends USD, like SF, so
// a city is always read from the restaurant or order it belongs to
// (`cityForRestaurantSlug`, order-store.ts), never inferred from a currency.
// The per-city values below are docs/design/229-la-catalogue.md's table.

export type City = 'sf' | 'hcmc' | 'la';
export type Currency = 'USD' | 'VND';

export const CITIES: City[] = ['sf', 'hcmc', 'la'];

export const CITY_CURRENCY: Record<City, Currency> = {
  sf: 'USD',
  hcmc: 'VND',
  la: 'USD',
};

export const CITY_LOCALE: Record<City, string> = {
  sf: 'en-US',
  hcmc: 'vi-VN',
  la: 'en-US',
};

export const CITY_NAMES: Record<City, string> = {
  sf: 'San Francisco',
  hcmc: 'Ho Chi Minh City',
  la: 'Los Angeles',
};

/** The tracker VIP card's short labels (docs/design/229-la-catalogue.md, "The 'other city' line"). */
export const CITY_SHORT_NAMES: Record<City, string> = {
  sf: 'SF',
  hcmc: 'HCMC',
  la: 'LA',
};

/** The locale a bare amount/currency pair formats in, when no city is known — each city's own `CITY_LOCALE` agrees with it (money.test.ts). */
const CURRENCY_LOCALE: Record<Currency, string> = {
  USD: 'en-US',
  VND: 'vi-VN',
};

/** The wallet kicker's noun for a currency ("... orders spend dollars."). */
const CURRENCY_NOUN: Record<Currency, string> = {
  USD: 'dollars',
  VND: 'đồng',
};

export function isCity(value: unknown): value is City {
  return (CITIES as unknown[]).includes(value);
}

export function currencyForCity(city: City): Currency {
  return CITY_CURRENCY[city];
}

/**
 * Formats a contract-shaped `amountMinor`/`currency` pair per its currency's
 * locale — `en-US`/`USD` (`$21.50`), `vi-VN`/`VND` (`15.000 ₫`: dot thousands
 * separator, no decimal part) — rather than a hand-built string, so neither
 * currency's convention is guessed at. It picks no city: a caller that knows
 * the city uses `formatMoneyForCity`.
 */
export function formatMoney(amountMinor: number, currency: Currency): string {
  return formatInLocale(amountMinor, currency, CURRENCY_LOCALE[currency]);
}

/** Formats in the city's own `CITY_LOCALE` — never a city guessed from the currency (#230). */
export function formatMoneyForCity(amountMinor: number, city: City): string {
  return formatInLocale(amountMinor, currencyForCity(city), CITY_LOCALE[city]);
}

function formatInLocale(amountMinor: number, currency: Currency, locale: string): string {
  const value = currency === 'USD' ? amountMinor / 100 : amountMinor;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(value);
}

// --- The "other city" line (docs/design/229-la-catalogue.md) ---
// It is really the other *currency*, labelled with every city that spends
// it: LA and SF share one USD balance, so neither is ever the other's
// "other city".

/** The currency the city does not spend. */
export function otherCurrencyForCity(city: City): Currency {
  return CITY_CURRENCY[city] === 'USD' ? 'VND' : 'USD';
}

/** Every city spending `currency`, in `CITIES` order, with `first` moved to the front when given. */
function citiesSpending(currency: Currency, first?: City): City[] {
  const spending = CITIES.filter((city) => CITY_CURRENCY[city] === currency);
  return first ? [first, ...spending.filter((city) => city !== first)] : spending;
}

/** The wallet sheet's other row label: "Ho Chi Minh City" from SF or LA, "San Francisco and Los Angeles" from HCMC. */
export function otherCurrencyCitiesLabel(city: City): string {
  return citiesSpending(otherCurrencyForCity(city)).map((c) => CITY_NAMES[c]).join(' and ');
}

/** The tracker VIP card's other-currency label: "HCMC" from SF or LA, "SF and LA" from HCMC. */
export function otherCurrencyCitiesShortLabel(city: City): string {
  return citiesSpending(otherCurrencyForCity(city)).map((c) => CITY_SHORT_NAMES[c]).join(' and ');
}

/** The wallet sheet's kicker: the current city first, then every other city sharing its currency. */
export function walletKicker(city: City): string {
  const currency = CITY_CURRENCY[city];
  const names = citiesSpending(currency, city).map((c) => CITY_NAMES[c]).join(' and ');
  return `Play money. ${names} orders spend ${CURRENCY_NOUN[currency]}.`;
}

/**
 * The wallet header chip's compact form (docs/design/143-wallet.md, "The
 * compact rule for long balances"): `Intl.NumberFormat`'s own
 * `notation: 'compact'`, through the same locale/currency pairing as
 * `formatMoneyForCity` rather than a hand-built abbreviation — the caller
 * decides when to use this over the full form (the mock's own 9-character
 * threshold, the width of `600.000 ₫`).
 */
export function formatMoneyCompactForCity(amountMinor: number, city: City): string {
  const currency = currencyForCity(city);
  const value = currency === 'USD' ? amountMinor / 100 : amountMinor;
  return new Intl.NumberFormat(CITY_LOCALE[city], {
    style: 'currency',
    currency,
    notation: 'compact',
  }).format(value);
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
