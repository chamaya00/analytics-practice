// #270 §5.3: which deploy produced a row. `__BUILD_SHA__` is defined at
// `astro build` time from Vercel's VERCEL_GIT_COMMIT_SHA (astro.config.mjs),
// because Astro exposes only PUBLIC_ variables to client code.

declare const __BUILD_SHA__: string | null | undefined;

/** The full 40-hex SHA lowercased, or the literal `(unknown)` when absent or malformed. Never null. */
export function normaliseBuild(raw: unknown): string {
  const sha = typeof raw === 'string' ? raw.toLowerCase() : '';
  return /^[0-9a-f]{40}$/.test(sha) ? sha : '(unknown)';
}

export const BUILD: string = normaliseBuild(typeof __BUILD_SHA__ === 'undefined' ? undefined : __BUILD_SHA__);
