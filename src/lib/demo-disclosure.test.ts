import { describe, expect, it } from 'vitest';
import { renderDemoDisclosure } from './demo-disclosure';

describe('renderDemoDisclosure (#149, AC5: what #136\'s wallet stores now)', () => {
  it('states signing in stores an email via Supabase Auth and a balance per account, alongside the original demo line', () => {
    const el = renderDemoDisclosure();
    expect(el.textContent).toContain('This is a demo. No payment is taken and no food is sent.');
    expect(el.textContent).toContain('Signing in stores an email, held by Supabase Auth, and your play-money balance per account.');
  });

  it('still links to /about', () => {
    const el = renderDemoDisclosure();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/about/');
  });
});
