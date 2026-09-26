// #80's "Demo disclosure" — a persistent callout carrying the fixed line
// "This is a demo. No payment is taken and no food is sent." plus a "What we
// log, and why →" link to /about, appearing at exactly two placements: above
// checkout's "Place order" (checkout-dom.ts) and above the tracker's
// Delivered-state rating prompt (tracker-dom.ts). Shared here, identical
// markup and copy, so the two call sites can't drift apart.

export function renderDemoDisclosure(): HTMLElement {
  const disclosure = document.createElement('div');
  disclosure.className = 'demo-disclosure';
  disclosure.setAttribute('data-testid', 'demo-disclosure');

  const text = document.createElement('span');
  text.textContent = 'This is a demo. No payment is taken and no food is sent. ';

  const link = document.createElement('a');
  link.href = '/about/';
  link.textContent = 'What we log, and why →';

  text.append(link);
  disclosure.append(text);
  return disclosure;
}
