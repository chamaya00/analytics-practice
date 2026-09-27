// Wallet build-gate config (ADR 0008 "D1, as a rule"; #136 driver comment
// 2026-09-27 17:31Z, restated on this issue as the binding rule): the wallet
// switches on only when auth config is present and its RPCs answer. This
// module is the first half — reading the config. `PUBLIC_WALLET_ENABLED` is
// the owner's own last switch, kept apart from the URL/key already live in
// production for events (ADR 0005), since those two are set well before the
// wallet is ready to turn on.

export interface WalletEnvConfig {
  url: string;
  publishableKey: string;
}

/**
 * `null` whenever any of the three is absent — the CI build, local dev, and
 * every deploy before the owner sets `PUBLIC_WALLET_ENABLED` (ADR 0008,
 * "Owner setup", last step). Nothing that depends on this reads or requests
 * anything further in that case (AC1).
 */
export function readWalletEnvConfig(): WalletEnvConfig | null {
  const enabled = import.meta.env.PUBLIC_WALLET_ENABLED === 'true';
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!enabled || !url || !publishableKey) return null;
  return { url, publishableKey };
}
