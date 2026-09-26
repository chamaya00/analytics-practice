import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney (AC1)', () => {
  it('formats a USD amount as en-US currency: $21.50', () => {
    expect(formatMoney(2150, 'USD')).toBe('$21.50');
  });

  it('formats a VND amount as vi-VN currency with a dot thousands separator and no decimal part', () => {
    // vi-VN's own Intl output separates the figure from the đồng sign with a
    // non-breaking space (U+00A0), not a plain space — asserted here rather
    // than eyeballed so this test fails if that ever silently changes.
    expect(formatMoney(15000, 'VND')).toBe('15.000 ₫');
  });

  it('formats a larger VND total the same way, matching #80\'s HCMC checkout mock', () => {
    expect(formatMoney(395000, 'VND')).toBe('395.000 ₫');
  });
});
