import { describe, expect, it } from 'vitest';
import { renderDemoDisclosure } from './demo-disclosure';

describe('renderDemoDisclosure (#149, AC5: what #136\'s wallet stores now)', () => {
  it('states signing in stores an email via Supabase Auth and a balance per account, alongside the original demo line, when the wallet is on', () => {
    const el = renderDemoDisclosure(true);
    expect(el.textContent).toContain('This is a demo. No payment is taken and no food is sent.');
    expect(el.textContent).toContain('Signing in stores an email, held by Supabase Auth, and your play-money balance per account.');
  });

  it('says nothing about signing in when the wallet is off for this build, since no visitor is offered it', () => {
    const el = renderDemoDisclosure(false);
    expect(el.textContent).toContain('This is a demo. No payment is taken and no food is sent.');
    expect(el.textContent).not.toContain('Signing in');
  });

  it('defaults to the build flag: off in a build with no PUBLIC_WALLET_ENABLED', () => {
    expect(renderDemoDisclosure().textContent).not.toContain('Signing in');
  });

  it('still links to /about', () => {
    for (const walletEnabled of [true, false]) {
      const el = renderDemoDisclosure(walletEnabled);
      expect(el.querySelector('a')?.getAttribute('href')).toBe('/about/');
    }
  });
});
