localStorage.setItem('parody.city', 'sf');
// An already-expired flash draw so the home feed renders without the flash
// sheet covering it (#130's renders are of the feed itself, not the sheet).
sessionStorage.setItem(
  'flashDeal:sf',
  JSON.stringify({
    drawnAt: Date.now() - 20 * 60 * 1000,
    amountMinor: 300,
    restaurants: [
      { slug: 'mission-taqueria', feeMode: 'free' },
      { slug: 'north-beach-pizzeria', feeMode: 'reduced' },
      { slug: 'golden-lotus-dim-sum', feeMode: 'free' },
      { slug: 'bay-grain-bowls', feeMode: 'reduced' },
      { slug: 'dogpatch-burger-works', feeMode: 'free' },
    ],
  }),
);
