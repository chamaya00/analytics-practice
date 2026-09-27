// #80's "Demo disclosure" — a persistent callout carrying the fixed line
// "This is a demo. No payment is taken and no food is sent." plus a "What we
// log, and why →" link to /about, appearing at exactly two placements: above
// checkout's "Place order" (checkout-dom.ts) and above the tracker's
// Delivered-state rating prompt (tracker-dom.ts). Shared here, identical
// markup and copy, so the two call sites can't drift apart.
//
// #149 adds a second sentence, plainly stating what #136's wallet stores now
// that "No account" has stopped being true: an email, held by Supabase Auth,
// and a play-money balance per account — neither ever added to an event
// (ADR 0008, the #79 rule). True everywhere this renders, whether or not the
// wallet is switched on for this build (D1): it describes the site, not the
// visitor's own session.

export function renderDemoDisclosure(): HTMLElement {
  const disclosure = document.createElement('div');
  disclosure.className = 'demo-disclosure';
  disclosure.setAttribute('data-testid', 'demo-disclosure');

  const iconWrapper = document.createElement('span');
  iconWrapper.innerHTML =
    '<svg class="icon-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none"/></svg>';
  const icon = iconWrapper.firstElementChild!;

  const text = document.createElement('span');
  text.textContent =
    'This is a demo. No payment is taken and no food is sent. Signing in stores an email, held by Supabase Auth, and your play-money balance per account. ';

  const link = document.createElement('a');
  link.href = '/about/';
  link.textContent = 'What we log, and why →';

  text.append(link);
  disclosure.append(icon, text);
  return disclosure;
}
