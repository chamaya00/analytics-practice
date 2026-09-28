// The wallet sheet's header from Ho Chi Minh City, with three cities - the kicker
// and the "other city" row (docs/design/229-la-catalogue.md, "The 'other
// city' line"). Deferred from #230 to #233 (D15 on #221).
//
// The wallet only exists on a build with PUBLIC_WALLET_ENABLED=true,
// PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY set, and for a
// signed-in visitor. So this seed is for a render built with
//   PUBLIC_WALLET_ENABLED=true
//   PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
//   PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_render_only
// in the environment of ./scripts/app-render, and it fakes the rest: a
// stored Supabase session (so supabase-js finds one without a network call),
// and a fetch that answers `wallet_get` with $20.00 / 100.000 ₫ and every
// other request (events) with an empty 201. Nothing leaves the page.
// Then it opens the sheet by clicking the header chip.

/* global window, document, Response -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
// A dismissed flash draw, so the flash sheet doesn't open under the wallet sheet.
window.sessionStorage.setItem(
  'flashDeal:hcmc',
  JSON.stringify({
    drawnAt: Date.now(),
    amountMinor: 30000,
    restaurants: [
      { slug: 'ben-thanh-banh-mi', feeMode: 'free' },
      { slug: 'saigon-pho-quan', feeMode: 'reduced' },
      { slug: 'hu-tieu-nam-vang-hoa-phat', feeMode: 'free' },
      { slug: 'bun-cha-co-ba', feeMode: 'reduced' },
      { slug: 'quan-lau-ut-hanh', feeMode: 'free' },
    ],
    collapsed: true,
    closedEventFired: true,
  }),
);
window.localStorage.setItem(
  'sb-abcdefghijklmnop-auth-token',
  JSON.stringify({
    access_token: 'render-only-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    refresh_token: 'render-only-refresh-token',
    user: {
      id: '23300000-0000-4000-8000-000000000233',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'render@example.com',
      app_metadata: { provider: 'google' },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  }),
);

window.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.includes('/rest/v1/rpc/wallet_get')) {
    return new Response(
      JSON.stringify({
        usd_minor: 2000,
        vnd_minor: 100000,
        window_start: new Date(Date.now() - 3_600_000).toISOString(),
        next_window_start: new Date(Date.now() + 3_600_000).toISOString(),
        claimed_this_window: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response(null, { status: 201 });
};

window.addEventListener('load', () => {
  const poll = window.setInterval(() => {
    const chip = document.querySelector('[data-testid="wallet-chip"]');
    if (chip) {
      chip.click();
      window.clearInterval(poll);
    }
  }, 50);
});
