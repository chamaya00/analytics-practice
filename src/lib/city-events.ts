// The one constant home-dom.ts (fires) and wallet-dom.ts (listens) share for
// "the current city just changed" — its own tiny module rather than an
// import from either side, so a page that only needs the wallet client
// (checkout, #149) never pulls in the whole home feed module just to read
// one string, and vice versa.

export const CITY_CHANGED_EVENT = 'parody:citychanged';
