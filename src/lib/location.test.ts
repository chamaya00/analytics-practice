import { beforeEach, describe, expect, it } from 'vitest';
import { getStoredCity, setStoredCity } from './location';

beforeEach(() => {
  window.localStorage.clear();
});

describe('getStoredCity (AC1)', () => {
  it('returns null on empty storage — the picker is shown, no default city guessed', () => {
    expect(getStoredCity(window.localStorage)).toBeNull();
  });

  it('returns the persisted city after it is set', () => {
    setStoredCity(window.localStorage, 'hcmc');
    expect(getStoredCity(window.localStorage)).toBe('hcmc');
  });

  it('falls back to null (the picker) on an unrecognised stored value, rather than throwing', () => {
    window.localStorage.setItem('parody.city', 'nowhereville');
    expect(() => getStoredCity(window.localStorage)).not.toThrow();
    expect(getStoredCity(window.localStorage)).toBeNull();
  });

  it('falls back to null when storage itself throws on read (private browsing)', () => {
    const throwing: Storage = {
      ...window.localStorage,
      getItem: () => {
        throw new Error('blocked');
      },
    } as Storage;
    expect(getStoredCity(throwing)).toBeNull();
  });
});

describe('setStoredCity (AC1, storage-blocked error state)', () => {
  it('returns true and persists when storage accepts the write', () => {
    expect(setStoredCity(window.localStorage, 'sf')).toBe(true);
    expect(getStoredCity(window.localStorage)).toBe('sf');
  });

  it('returns false rather than throwing when storage.setItem throws (private browsing)', () => {
    const throwing: Storage = {
      ...window.localStorage,
      setItem: () => {
        throw new Error('blocked');
      },
    } as Storage;
    expect(() => setStoredCity(throwing, 'sf')).not.toThrow();
    expect(setStoredCity(throwing, 'sf')).toBe(false);
  });
});
