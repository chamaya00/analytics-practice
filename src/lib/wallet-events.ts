// The one constant tracker-dom.ts (fires, after a tip changes a balance) and
// wallet-dom.ts (listens, to keep the header chip in sync) share — its own
// tiny module rather than an import from either side, the same reasoning
// city-events.ts already gives for CITY_CHANGED_EVENT: a page that only needs
// one side never pulls in the other's whole module just to read one string.

export const WALLET_BALANCE_CHANGED_EVENT = 'parody:walletbalancechanged';

export interface WalletBalanceChangedDetail {
  usdMinor: number;
  vndMinor: number;
}
