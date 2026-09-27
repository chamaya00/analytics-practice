import { describe, expect, it } from 'vitest';
import { downloadUrl, entriesToFetch, pickResult, validateEntry } from './fetch-photos.mjs';

const good = { path: 'public/images/restaurants/ben-thanh-banh-mi.jpg', query: 'banh mi sandwich', width: 320, height: 240 };

describe('fetch-photos manifest validation', () => {
  it('accepts a well-formed entry', () => {
    expect(validateEntry(good)).toEqual([]);
  });

  it('refuses a path outside public/images or not a .jpg', () => {
    expect(validateEntry({ ...good, path: 'src/lib/x.jpg' })).not.toEqual([]);
    expect(validateEntry({ ...good, path: 'public/images/../../x.jpg' })).not.toEqual([]);
    expect(validateEntry({ ...good, path: 'public/images/x.svg' })).not.toEqual([]);
  });

  it('refuses a missing query and out-of-range sizes', () => {
    expect(validateEntry({ ...good, query: ' ' })).not.toEqual([]);
    expect(validateEntry({ ...good, width: 5000 })).not.toEqual([]);
  });
});

describe('fetch-photos download URL', () => {
  it('crops on the Unsplash CDN at 2x the slot size, as a JPEG', () => {
    const url = new URL(downloadUrl('https://images.unsplash.com/photo-123?ixid=abc', 320, 240));
    expect(url.hostname).toBe('images.unsplash.com');
    expect(url.searchParams.get('w')).toBe('640');
    expect(url.searchParams.get('h')).toBe('480');
    expect(url.searchParams.get('fm')).toBe('jpg');
    expect(url.searchParams.get('ixid')).toBe('abc');
  });

  it('refuses any other image host', () => {
    expect(() => downloadUrl('https://example.com/photo.jpg', 320, 240)).toThrow(/non-Unsplash/);
  });
});

describe('fetch-photos selection', () => {
  it('skips a photo another slot already uses', () => {
    const results = [{ id: 'a', urls: { raw: 'x' } }, { id: 'b', urls: { raw: 'y' } }];
    expect(pickResult(results, new Set(['a']))?.id).toBe('b');
    expect(pickResult(results, new Set(['a', 'b']))).toBeNull();
  });

  it('fetches only missing files and changed pins', () => {
    const entries = [good, { ...good, path: 'public/images/a.jpg' }, { ...good, path: 'public/images/b.jpg', photo: 'newpin123' }];
    const lock = { [good.path]: { id: 'old' }, 'public/images/b.jpg': { id: 'oldpin123' } };
    const exists = (path: string) => path !== 'public/images/a.jpg';
    expect(entriesToFetch(entries, lock, exists).map((e: { path: string }) => e.path)).toEqual([
      'public/images/a.jpg',
      'public/images/b.jpg',
    ]);
  });
});
