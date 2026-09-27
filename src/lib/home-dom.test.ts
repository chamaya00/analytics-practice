import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initHomePage } from './home-dom';
import { getStoredCity } from './location';
import { restaurantsForCity, getRestaurant } from './restaurants';
import { resetTrack, setTrack } from './tracking';
import { formatReviewCount } from './reviews';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  resetTrack();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

// Stand-in for Header.astro's home-only `[data-testid="city-pill-slot"]` —
// home-dom.ts renders the city pill into whatever element it's given,
// production wiring finds the real one via document.querySelector
// (src/pages/index.astro); tests build their own so each test's pill is
// unambiguous rather than relying on a shared document-wide lookup.
function pillRoot(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function mockMatchMedia(reducedMotion: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') && reducedMotion,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('initHomePage — no persisted city (AC1)', () => {
  it('shows the location picker with both city cards, and does not fire home_viewed yet', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initHomePage(el, pillRoot(), window.localStorage);

    expect(el.querySelector('[data-testid="location-picker"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="location-card-sf"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="location-card-hcmc"]')).not.toBeNull();
    expect(stub).not.toHaveBeenCalledWith('home_viewed', expect.anything());
  });

  it('picking San Francisco persists the choice, fires location_selected then home_viewed, and shows only SF restaurants', () => {
    const events: [string, unknown][] = [];
    setTrack((name, props) => events.push([name, props]));
    const el = root();

    initHomePage(el, pillRoot(), window.localStorage);
    el.querySelector<HTMLButtonElement>('[data-testid="location-card-sf"]')?.click();

    expect(getStoredCity(window.localStorage)).toBe('sf');
    // The first load also draws and shows this session's flash deal (#89) — its own event/props are covered
    // in home-dom's flash-deal tests below; this test's own concern is the location/home_viewed sequence.
    const nonFlashEvents = events.filter(([name]) => name !== 'flash_sheet_shown');
    expect(nonFlashEvents).toEqual([
      ['location_selected', { city: 'sf', is_switch: false }],
      ['home_viewed', { city: 'sf' }],
    ]);

    for (const restaurant of restaurantsForCity('sf')) {
      expect(el.querySelector(`[data-testid="restaurant-card-${restaurant.slug}"]`)).not.toBeNull();
    }
    for (const restaurant of restaurantsForCity('hcmc')) {
      expect(el.querySelector(`[data-testid="restaurant-card-${restaurant.slug}"]`)).toBeNull();
    }
  });

  it('shows the storage-blocked inline notice up front, and still proceeds to the feed on a tap', () => {
    const throwing: Storage = {
      ...window.localStorage,
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    } as Storage;
    const el = root();

    initHomePage(el, pillRoot(), throwing);
    expect(el.querySelector('[data-testid="location-blocked-notice"]')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('[data-testid="location-card-hcmc"]')?.click();
    expect(el.querySelector('[data-testid="home-feed"]')).not.toBeNull();
  });
});

describe('initHomePage — persisted city (AC1)', () => {
  it('renders the feed directly and fires home_viewed with the stored city', () => {
    window.localStorage.setItem('parody.city', 'hcmc');
    const stub = vi.fn();
    setTrack(stub);

    initHomePage(root(), pillRoot(), window.localStorage);

    expect(stub).toHaveBeenCalledWith('home_viewed', { city: 'hcmc' });
  });

  it('falls back to the picker on an unrecognised stored value, rather than throwing', () => {
    window.localStorage.setItem('parody.city', 'nowhereville');
    const el = root();

    expect(() => initHomePage(el, pillRoot(), window.localStorage)).not.toThrow();
    expect(el.querySelector('[data-testid="location-picker"]')).not.toBeNull();
  });
});

describe('the city pill (moved into the header row, #137)', () => {
  it('renders into the given pillRoot, not into the feed root, and opens the location picker on tap', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    const pill = pillRoot();
    initHomePage(el, pill, window.localStorage);

    expect(el.querySelector('[data-testid="location-bar"]')).toBeNull();
    const bar = pill.querySelector<HTMLButtonElement>('[data-testid="location-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.textContent).toBe('San Francisco ▾');

    bar?.click();
    expect(el.querySelector('[data-testid="location-picker"]')).not.toBeNull();
  });

  it('a city switch rewrites the pill to the new city', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    const pill = pillRoot();
    initHomePage(el, pill, window.localStorage, window.sessionStorage);

    pill.querySelector<HTMLButtonElement>('[data-testid="location-bar"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="location-card-hcmc"]')?.click();

    expect(pill.querySelector('[data-testid="location-bar"]')?.textContent).toBe('Ho Chi Minh City ▾');
  });
});

describe('home feed contents (AC2)', () => {
  it('renders the carousel, cuisine shortcut chips, and a restaurant tile with photo, rating, ETA, delivery fee and deal badge', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    expect(el.querySelectorAll('[data-testid="carousel"]')).toHaveLength(1);
    expect(el.querySelector('[data-testid="cuisine-chips"]')?.children.length).toBeGreaterThan(0);

    const dealRestaurant = restaurantsForCity('sf').find((restaurant) => restaurant.hasDeal)!;
    const card = el.querySelector(`[data-testid="restaurant-card-${dealRestaurant.slug}"]`);
    expect(card?.classList.contains('tile-card')).toBe(true);
    expect(card?.querySelector('img.tile-card-photo')).not.toBeNull();
    expect(card?.textContent).toContain(dealRestaurant.rating.toFixed(1));
    // #82 review round 2, item 2: the fee reads "$1.99 delivery" / "15.000 ₫ delivery",
    // not the bare amount — the word was dropped when the card was laid out in round 1.
    // Allows an optional trailing "Flash" badge text (#104: appended inside this same
    // element, beside the meta line, when this session's flash draw covers the card).
    expect(card?.querySelector('.tile-card-meta')?.textContent).toMatch(/delivery(Flash)?$/);
    expect(card?.querySelector(`[data-testid="deal-badge-${dealRestaurant.slug}"]`)).not.toBeNull();

    // #137's tile anatomy: rating with count on its own line (cuisine tag
    // dropped from the tile — still reachable via the shortcut chips above
    // the grid, per the design doc's own "guesses" section).
    const rating = card?.querySelector('.tile-card-rating');
    expect(rating?.textContent).toBe(`★ ${dealRestaurant.rating.toFixed(1)} (${formatReviewCount(dealRestaurant.reviewCount)})`);

    // #130 AC4: a car icon (SF) leads the meta line, immediately before the
    // "N min" estimate — no space character between them, since the gap is
    // the icon's own CSS margin (round 1 review, item 3: two sources of gap
    // read as two spaces).
    const meta = card?.querySelector('.tile-card-meta');
    const icon = meta?.querySelector('.vehicle-icon');
    expect(icon).not.toBeNull();
    expect(meta?.firstChild).toBe(icon);
    expect(icon?.getAttribute('data-vehicle')).toBe('car');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.nextSibling?.textContent).toMatch(/^\d+ min/);

    const noDealRestaurant = restaurantsForCity('sf').find((restaurant) => !restaurant.hasDeal)!;
    const plainCard = el.querySelector(`[data-testid="restaurant-card-${noDealRestaurant.slug}"]`);
    expect(plainCard?.querySelector('.deal-badge')).toBeNull();
  });

  it('an HCMC restaurant tile shows a motorbike icon, not a car (#130 AC4)', () => {
    window.localStorage.setItem('parody.city', 'hcmc');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const restaurant = restaurantsForCity('hcmc')[0];
    const meta = el.querySelector(`[data-testid="restaurant-card-${restaurant.slug}"] .tile-card-meta`);
    const icon = meta?.querySelector('.vehicle-icon');
    expect(icon?.getAttribute('data-vehicle')).toBe('motorbike');
  });

  it('the "Near you" section is a 2-column grid of new .tile-card markup, not a restyled .restaurant-card', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const grid = el.querySelector('[data-testid="restaurant-list"]');
    expect(grid?.classList.contains('tile-grid')).toBe(true);
    expect(grid?.querySelectorAll('.tile-card').length).toBeGreaterThan(0);
    expect(grid?.querySelectorAll('.restaurant-card').length).toBe(0);
  });

  it('a long HCMC restaurant name renders in full on its tile, no truncation', () => {
    window.localStorage.setItem('parody.city', 'hcmc');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const longName = getRestaurant('bo-bit-tet-chu-tam-go-vap')!;
    const card = el.querySelector(`[data-testid="restaurant-card-${longName.slug}"]`);
    const name = card?.querySelector('.tile-card-name');
    expect(name?.textContent).toBe(longName.name);
  });

  it('an empty search names the current city rather than a generic empty state', () => {
    window.localStorage.setItem('parody.city', 'hcmc');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const search = el.querySelector<HTMLInputElement>('[data-testid="home-search"]')!;
    search.value = 'ramen';
    search.dispatchEvent(new Event('input'));

    expect(el.querySelector('[data-testid="home-empty"]')?.textContent).toContain('Ho Chi Minh City');
    expect(el.querySelector('[data-testid="restaurant-list"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('shows a "Near you" heading above the tile grid, and every restaurant for the city (#104; 14 each since catalogue-more.ts)', () => {
    expect(restaurantsForCity('sf')).toHaveLength(14);
    expect(restaurantsForCity('hcmc')).toHaveLength(14);

    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    expect(el.querySelector('[data-testid="near-you-heading"]')?.textContent).toBe('Near you');
    expect(el.querySelectorAll('[data-testid^="restaurant-card-"]')).toHaveLength(14);
  });
});

describe('the promo carousel (#137 AC2-AC8)', () => {
  it('shows 7 slides matching the design doc\'s named content for SF: the first-order claim, 3 Ad slides for 3 distinct restaurants, 3 promo slides for 3 other distinct restaurants naming real menu items', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const dots = el.querySelectorAll('[data-testid="carousel-dots"] .carousel-dot');
    expect(dots).toHaveLength(7);

    const expected: Array<{ claim: string; sub: string; isAd: boolean; href: string | null }> = [
      { claim: '$2 off your first order', sub: 'Applied automatically at checkout', isAd: false, href: null },
      { claim: 'Mission Taqueria', sub: 'Tacos · ★ 4.6', isAd: true, href: '/restaurants/mission-taqueria/' },
      {
        claim: 'Free Garlic knots with a $20 minimum',
        sub: 'North Beach Pizzeria',
        isAd: false,
        href: '/restaurants/north-beach-pizzeria/',
      },
      { claim: 'Inner Richmond Sushi Bar', sub: 'Sushi · ★ 4.8', isAd: true, href: '/restaurants/inner-richmond-sushi-bar/' },
      {
        claim: 'Buy 1 get 1 free: Buttermilk pancakes',
        sub: 'Noe Valley Morning Kitchen',
        isAd: false,
        href: '/restaurants/noe-valley-morning-kitchen/',
      },
      { claim: 'Ocean Beach Fish House', sub: 'Seafood · ★ 4.8', isAd: true, href: '/restaurants/ocean-beach-fish-house/' },
      {
        claim: 'Free Mango lassi with a $18 minimum',
        sub: 'Valencia Street Tandoor',
        isAd: false,
        href: '/restaurants/valencia-street-tandoor/',
      },
    ];

    for (const [index, slide] of expected.entries()) {
      el.querySelectorAll('[data-testid="carousel-dots"] .carousel-dot')[index].dispatchEvent(new Event('click', { bubbles: true }));
      expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent, `slide ${index}`).toBe(slide.claim);
      expect(el.querySelector('[data-testid="carousel-sub"]')?.textContent, `slide ${index}`).toBe(slide.sub);
      const link = el.querySelector('[data-testid="carousel-slide-link"]');
      expect(link?.tagName, `slide ${index} tag`).toBe(slide.href ? 'A' : 'DIV');
      if (slide.href) expect((link as HTMLAnchorElement).getAttribute('href')).toBe(slide.href);
      expect(el.querySelector('[data-testid="carousel-ad-label"]') !== null, `slide ${index} ad label`).toBe(slide.isAd);
    }
  });

  it('shows 7 slides matching the design doc\'s named content for HCMC', () => {
    window.localStorage.setItem('parody.city', 'hcmc');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const expected: Array<{ claim: string; sub: string; isAd: boolean }> = [
      { claim: '10.000 ₫ off your first order', sub: 'Applied automatically at checkout', isAd: false },
      { claim: 'Bến Thành Bánh Mì', sub: 'Bánh mì · ★ 4.8', isAd: true },
      { claim: 'Free Gỏi cuốn with an 80.000 ₫ minimum', sub: 'Sài Gòn Phở Quán', isAd: false },
      { claim: 'Hủ Tiếu Nam Vang Hòa Phát', sub: 'Hủ tiếu · ★ 4.6', isAd: true },
      { claim: 'Buy 1 get 1 free: Bún chả Hà Nội', sub: 'Bún Chả Cô Ba', isAd: false },
      { claim: 'Quán Lẩu Út Hạnh', sub: 'Lẩu · ★ 4.7', isAd: true },
      { claim: 'Free Khoai tây chiên with a 150.000 ₫ minimum', sub: 'Bò Bít Tết Chú Tám Gò Vấp', isAd: false },
    ];

    const dots = el.querySelectorAll('[data-testid="carousel-dots"] .carousel-dot');
    expect(dots).toHaveLength(7);
    for (const [index, slide] of expected.entries()) {
      dots[index].dispatchEvent(new Event('click', { bubbles: true }));
      expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent, `slide ${index}`).toBe(slide.claim);
      expect(el.querySelector('[data-testid="carousel-sub"]')?.textContent, `slide ${index}`).toBe(slide.sub);
      expect(el.querySelector('[data-testid="carousel-ad-label"]') !== null, `slide ${index} ad label`).toBe(slide.isAd);
    }
  });

  it('tapping a restaurant slide opens that restaurant\'s menu; tapping the first-order slide goes nowhere', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    // Slide 0 is the first-order slide — a non-navigable <div>, not an <a>.
    const firstOrderLink = el.querySelector('[data-testid="carousel-slide-link"]');
    expect(firstOrderLink?.tagName).toBe('DIV');
    expect(firstOrderLink?.hasAttribute('href')).toBe(false);

    el.querySelectorAll('[data-testid="carousel-dots"] .carousel-dot')[1].dispatchEvent(new Event('click', { bubbles: true }));
    const adLink = el.querySelector('[data-testid="carousel-slide-link"]');
    expect(adLink?.tagName).toBe('A');
    expect((adLink as HTMLAnchorElement).getAttribute('href')).toBe('/restaurants/mission-taqueria/');
  });

  it('advances automatically while idle, and loops back to the first slide', () => {
    vi.useFakeTimers();
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('$2 off your first order');

    vi.advanceTimersByTime(5000);
    expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('Mission Taqueria');

    vi.advanceTimersByTime(5000 * 6);
    // 7 total advances from slide 0 lands back on slide 0.
    expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('$2 off your first order');
  });

  it('does not auto-advance under prefers-reduced-motion: reduce', () => {
    mockMatchMedia(true);
    vi.useFakeTimers();
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const before = el.querySelector('[data-testid="carousel-claim"]')?.textContent;
    vi.advanceTimersByTime(20000);
    expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe(before);
  });

  it('pauses auto-advance while the carousel is being touched/pointed/focused, and resumes about 5s after the interaction ends', () => {
    vi.useFakeTimers();
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const carousel = el.querySelector('[data-testid="carousel"]')!;
    carousel.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    // Idle time passes while the interaction is ongoing — no advance, since
    // rotation is paused for the interaction's duration.
    vi.advanceTimersByTime(20000);
    expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('$2 off your first order');

    carousel.dispatchEvent(new Event('pointerup', { bubbles: true }));

    // Not yet resumed immediately after the interaction ends.
    vi.advanceTimersByTime(4000);
    expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('$2 off your first order');

    // ~5s after the interaction ended, auto-advance resumes (a new 5s
    // interval starts) — its first tick lands 5s after that, so the slide
    // actually changes 10s after the interaction ended.
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(5000);
    expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('Mission Taqueria');
  });

  it('touch and focus interactions pause auto-advance the same way pointer interaction does', () => {
    vi.useFakeTimers();
    window.localStorage.setItem('parody.city', 'sf');

    const touchEl = root();
    initHomePage(touchEl, pillRoot(), window.localStorage);
    touchEl.querySelector('[data-testid="carousel"]')!.dispatchEvent(new Event('touchstart', { bubbles: true }));
    vi.advanceTimersByTime(20000);
    expect(touchEl.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('$2 off your first order');

    const focusEl = root();
    initHomePage(focusEl, pillRoot(), window.localStorage);
    focusEl.querySelector('[data-testid="carousel"]')!.dispatchEvent(new Event('focusin', { bubbles: true }));
    vi.advanceTimersByTime(20000);
    expect(focusEl.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('$2 off your first order');
  });

  it('a pause-button press is the only interaction that stops rotation for good, outlasting a timer advance that would otherwise resume it', () => {
    vi.useFakeTimers();
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const pauseButton = el.querySelector<HTMLButtonElement>('[data-testid="carousel-pause"]')!;
    expect(pauseButton.getAttribute('aria-label')).toBe('Pause carousel');

    pauseButton.click();
    expect(pauseButton.getAttribute('aria-label')).toBe('Play carousel');

    // A temporary touch pause would have resumed by now (previous test) —
    // the explicit pause button must not.
    vi.advanceTimersByTime(20000);
    expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('$2 off your first order');

    pauseButton.click();
    expect(pauseButton.getAttribute('aria-label')).toBe('Pause carousel');
    vi.advanceTimersByTime(5000);
    expect(el.querySelector('[data-testid="carousel-claim"]')?.textContent).toBe('Mission Taqueria');
  });

  it('shows a position indicator (7 real dot controls) with the current slide marked', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage);

    const dots = el.querySelectorAll<HTMLButtonElement>('[data-testid="carousel-dots"] .carousel-dot');
    expect(dots).toHaveLength(7);
    expect(dots[0].tagName).toBe('BUTTON');
    expect(dots[0].getAttribute('aria-current')).toBe('true');
    expect(dots[1].getAttribute('aria-current')).toBe('false');

    dots[2].click();
    expect(dots[0].getAttribute('aria-current')).toBe('false');
    expect(dots[2].getAttribute('aria-current')).toBe('true');
  });

  it('clears the previous carousel\'s auto-advance interval before the next renderFeed() starts one, so at most one carousel interval is ever live', () => {
    // The flash-deal sheet/reopen-bar also call setInterval (their own 1s
    // countdown ticks, flash-sheet-dom.ts), so this isolates the carousel's
    // own 5s interval by its distinct delay rather than counting every
    // setInterval call in the page.
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    const pill = pillRoot();
    initHomePage(el, pill, window.localStorage, window.sessionStorage);

    const carouselIntervalCalls = () => setIntervalSpy.mock.calls.filter(([, delay]) => delay === 5000);
    expect(carouselIntervalCalls()).toHaveLength(1);
    const firstIntervalId = setIntervalSpy.mock.results[setIntervalSpy.mock.calls.indexOf(carouselIntervalCalls()[0])].value;

    pill.querySelector<HTMLButtonElement>('[data-testid="location-bar"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="location-card-hcmc"]')?.click();

    expect(carouselIntervalCalls()).toHaveLength(2);
    expect(clearIntervalSpy).toHaveBeenCalledWith(firstIntervalId);
  });
});

describe('the flash-deal sheet on the home feed (AC4, AC6)', () => {
  it('the first load this session draws and stores under flashDeal:<city>; flash_sheet_shown goes quiet for a 5-6 restaurant draw (AC6)', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const stub = vi.fn();
    setTrack(stub);

    initHomePage(root(), pillRoot(), window.localStorage, window.sessionStorage);

    // #120: the draw is now 5-6 restaurants, but flash_sheet_shown's own
    // contract (isValidRestaurantSlugs in tracking.ts) still requires
    // exactly 2 slugs, unchanged - so the event is dropped by that
    // validation rather than firing with a truncated or widened shape.
    const shown = stub.mock.calls.filter(([name]) => name === 'flash_sheet_shown');
    expect(shown).toHaveLength(0);
    expect(window.sessionStorage.getItem('flashDeal:sf')).not.toBeNull();
  });

  it('the sheet is present in the DOM on first load', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage, window.sessionStorage);
    expect(el.querySelector('[data-testid="flash-sheet"]')).not.toBeNull();
  });

  it('reloading the feed in the same session does not redraw or reopen the sheet', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const stub = vi.fn();
    setTrack(stub);

    initHomePage(root(), pillRoot(), window.localStorage, window.sessionStorage);
    const firstDraw = window.sessionStorage.getItem('flashDeal:sf');

    const second = root();
    initHomePage(second, pillRoot(), window.localStorage, window.sessionStorage);

    expect(window.sessionStorage.getItem('flashDeal:sf')).toBe(firstDraw);
    expect(second.querySelector('[data-testid="flash-sheet"]')).toBeNull();
    expect(stub.mock.calls.filter(([name]) => name === 'flash_sheet_shown')).toHaveLength(0);
  });

  it('the first visit to the other city this session makes its own independent draw and shows its own sheet', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    const pill = pillRoot();

    initHomePage(el, pill, window.localStorage, window.sessionStorage);
    pill.querySelector<HTMLButtonElement>('[data-testid="location-bar"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="location-card-hcmc"]')?.click();

    expect(window.sessionStorage.getItem('flashDeal:sf')).not.toBeNull();
    expect(window.sessionStorage.getItem('flashDeal:hcmc')).not.toBeNull();
    expect(window.sessionStorage.getItem('flashDeal:sf')).not.toBe(window.sessionStorage.getItem('flashDeal:hcmc'));
  });

  it('a flash-active restaurant shows the Flash marker as a small badge beside the meta line, not a full-width bar underneath it (#104)', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();

    initHomePage(el, pillRoot(), window.localStorage, window.sessionStorage);

    const draw = JSON.parse(window.sessionStorage.getItem('flashDeal:sf')!) as { restaurants: { slug: string }[] };
    const flashSlug = draw.restaurants[0].slug;
    const badge = el.querySelector(`[data-testid="flash-badge-${flashSlug}"]`);

    expect(badge).not.toBeNull();
    // Beside the meta line: a child of .tile-card-meta, not a sibling
    // block rendered on its own row underneath the card body.
    expect(badge?.parentElement).toBe(el.querySelector(`[data-testid="restaurant-card-${flashSlug}"] .tile-card-meta`));
  });

  it('every one of the drawn 5-6 restaurants gets the Flash badge, not just the first (#120 AC4)', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();

    initHomePage(el, pillRoot(), window.localStorage, window.sessionStorage);

    const draw = JSON.parse(window.sessionStorage.getItem('flashDeal:sf')!) as { restaurants: { slug: string }[] };
    expect(draw.restaurants.length).toBeGreaterThanOrEqual(5);
    expect(draw.restaurants.length).toBeLessThanOrEqual(6);
    for (const restaurant of draw.restaurants) {
      expect(el.querySelector(`[data-testid="flash-badge-${restaurant.slug}"]`)).not.toBeNull();
    }
  });
});

describe('the collapsed reopen bar (AC2, AC3)', () => {
  it('dismissing the sheet collapses it into a reopen bar, persisted so a reload of the feed still shows it', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage, window.sessionStorage);

    el.querySelector<HTMLElement>('[data-testid="flash-sheet-scrim"]')?.click();

    expect(el.querySelector('[data-testid="flash-sheet"]')).toBeNull();
    expect(el.querySelector('[data-testid="flash-reopen-bar"]')).not.toBeNull();

    const stored = JSON.parse(window.sessionStorage.getItem('flashDeal:sf')!) as { collapsed?: boolean };
    expect(stored.collapsed).toBe(true);

    // A reload of the home page (a fresh initHomePage call, same session):
    // the bar reappears because the collapsed state was stored alongside
    // the draw, not merely held in memory (AC2).
    const reloaded = root();
    initHomePage(reloaded, pillRoot(), window.localStorage, window.sessionStorage);
    expect(reloaded.querySelector('[data-testid="flash-reopen-bar"]')).not.toBeNull();
    expect(reloaded.querySelector('[data-testid="flash-sheet"]')).toBeNull();
  });

  it('tapping the reopen bar reopens the sheet and removes the bar', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage, window.sessionStorage);

    el.querySelector<HTMLElement>('[data-testid="flash-sheet-scrim"]')?.click();
    el.querySelector<HTMLElement>('[data-testid="flash-reopen-bar"]')?.click();

    expect(el.querySelector('[data-testid="flash-sheet"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="flash-reopen-bar"]')).toBeNull();
  });

  it('closing the sheet again after reopening from the bar fires no further flash_sheet_closed (AC7)', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initHomePage(el, pillRoot(), window.localStorage, window.sessionStorage);

    el.querySelector<HTMLElement>('[data-testid="flash-sheet-scrim"]')?.click(); // dismiss: fires once, collapses
    el.querySelector<HTMLElement>('[data-testid="flash-reopen-bar"]')?.click(); // reopen
    el.querySelector<HTMLElement>('[data-testid="flash-sheet-scrim"]')?.click(); // dismiss again: no further event

    expect(stub.mock.calls.filter(([name]) => name === 'flash_sheet_closed')).toHaveLength(1);
    expect(el.querySelector('[data-testid="flash-reopen-bar"]')).not.toBeNull();
  });
});
