/// <reference types="astro/client" />

// ADR 0005: the store's URL and publishable key, read client-side. Both are
// optional — absent in CI, local dev, and an unconfigured preview deploy,
// where tracking-transport.ts's `initTracking` leaves `track` at its no-op
// default rather than throwing.
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
