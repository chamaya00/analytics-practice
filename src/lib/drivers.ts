// The driver pool an order draws from — #144, parent #134: each city gets 25
// stable drivers so a placed order can carry one without inventing a person
// per order. Picked from the order's own restaurant's city (#129/#130's
// precedent: never the city picker), once, at placeOrder, with the same
// injectable-`random` pattern pickDeliveryMs (order-store.ts) and
// drawFlashDeal (flash-deal.ts) already use — so a test can assert the exact
// driver under a seeded source rather than only "it's one of the 25."
//
// Avatars are a later child's job (#144's own scope line): this only needs a
// stable `id` for that child to key one to.

import type { City } from './money';

export interface Driver {
  id: string;
  /** First name plus last initial ("Minh T.", "Sarah K.") — never a full surname, so no pool entry reads as a real person. */
  name: string;
  rating: number;
  ratingCount: number;
}

const SF_DRIVERS: Driver[] = [
  { id: 'sf-driver-01', name: 'Sarah K.', rating: 4.9, ratingCount: 2143 },
  { id: 'sf-driver-02', name: 'James O.', rating: 4.7, ratingCount: 856 },
  { id: 'sf-driver-03', name: 'Maria G.', rating: 4.8, ratingCount: 1590 },
  { id: 'sf-driver-04', name: 'David L.', rating: 4.6, ratingCount: 412 },
  { id: 'sf-driver-05', name: 'Emily R.', rating: 4.9, ratingCount: 3021 },
  { id: 'sf-driver-06', name: 'Michael S.', rating: 4.7, ratingCount: 998 },
  { id: 'sf-driver-07', name: 'Jessica T.', rating: 4.8, ratingCount: 1204 },
  { id: 'sf-driver-08', name: 'Daniel P.', rating: 4.5, ratingCount: 276 },
  { id: 'sf-driver-09', name: 'Ashley N.', rating: 4.9, ratingCount: 1877 },
  { id: 'sf-driver-10', name: 'Christopher B.', rating: 4.6, ratingCount: 645 },
  { id: 'sf-driver-11', name: 'Amanda W.', rating: 4.8, ratingCount: 1339 },
  { id: 'sf-driver-12', name: 'Matthew H.', rating: 4.7, ratingCount: 782 },
  { id: 'sf-driver-13', name: 'Stephanie C.', rating: 4.9, ratingCount: 2508 },
  { id: 'sf-driver-14', name: 'Joshua F.', rating: 4.5, ratingCount: 359 },
  { id: 'sf-driver-15', name: 'Nicole D.', rating: 4.8, ratingCount: 1122 },
  { id: 'sf-driver-16', name: 'Andrew M.', rating: 4.6, ratingCount: 501 },
  { id: 'sf-driver-17', name: 'Elena V.', rating: 4.9, ratingCount: 1965 },
  { id: 'sf-driver-18', name: 'Ryan J.', rating: 4.7, ratingCount: 891 },
  { id: 'sf-driver-19', name: 'Priya A.', rating: 4.8, ratingCount: 1450 },
  { id: 'sf-driver-20', name: 'Kevin Y.', rating: 4.6, ratingCount: 623 },
  { id: 'sf-driver-21', name: 'Rachel E.', rating: 4.9, ratingCount: 2789 },
  { id: 'sf-driver-22', name: 'Brandon Q.', rating: 4.5, ratingCount: 314 },
  { id: 'sf-driver-23', name: 'Michelle U.', rating: 4.8, ratingCount: 1683 },
  { id: 'sf-driver-24', name: 'Tyler I.', rating: 4.7, ratingCount: 947 },
  { id: 'sf-driver-25', name: 'Jasmine Z.', rating: 4.9, ratingCount: 2231 },
];

const HCMC_DRIVERS: Driver[] = [
  { id: 'hcmc-driver-01', name: 'Minh T.', rating: 4.9, ratingCount: 3312 },
  { id: 'hcmc-driver-02', name: 'Linh N.', rating: 4.7, ratingCount: 1024 },
  { id: 'hcmc-driver-03', name: 'Hùng P.', rating: 4.8, ratingCount: 1876 },
  { id: 'hcmc-driver-04', name: 'Thảo L.', rating: 4.6, ratingCount: 542 },
  { id: 'hcmc-driver-05', name: 'Đức V.', rating: 4.9, ratingCount: 2967 },
  { id: 'hcmc-driver-06', name: 'Mai H.', rating: 4.7, ratingCount: 1189 },
  { id: 'hcmc-driver-07', name: 'Tuấn N.', rating: 4.8, ratingCount: 1502 },
  { id: 'hcmc-driver-08', name: 'Hương T.', rating: 4.5, ratingCount: 398 },
  { id: 'hcmc-driver-09', name: 'Long D.', rating: 4.9, ratingCount: 2214 },
  { id: 'hcmc-driver-10', name: 'Trang B.', rating: 4.6, ratingCount: 671 },
  { id: 'hcmc-driver-11', name: 'Khánh N.', rating: 4.8, ratingCount: 1655 },
  { id: 'hcmc-driver-12', name: 'Ngọc P.', rating: 4.7, ratingCount: 913 },
  { id: 'hcmc-driver-13', name: 'Phong L.', rating: 4.9, ratingCount: 2740 },
  { id: 'hcmc-driver-14', name: 'Yến H.', rating: 4.5, ratingCount: 287 },
  { id: 'hcmc-driver-15', name: 'Quang V.', rating: 4.8, ratingCount: 1348 },
  { id: 'hcmc-driver-16', name: 'Chi N.', rating: 4.6, ratingCount: 559 },
  { id: 'hcmc-driver-17', name: 'Bảo T.', rating: 4.9, ratingCount: 2088 },
  { id: 'hcmc-driver-18', name: 'Hạnh D.', rating: 4.7, ratingCount: 824 },
  { id: 'hcmc-driver-19', name: 'Sơn N.', rating: 4.8, ratingCount: 1721 },
  { id: 'hcmc-driver-20', name: 'Vy L.', rating: 4.6, ratingCount: 486 },
  { id: 'hcmc-driver-21', name: 'Nam T.', rating: 4.9, ratingCount: 2453 },
  { id: 'hcmc-driver-22', name: 'Thu H.', rating: 4.5, ratingCount: 335 },
  { id: 'hcmc-driver-23', name: 'Kiên P.', rating: 4.8, ratingCount: 1567 },
  { id: 'hcmc-driver-24', name: 'Anh N.', rating: 4.7, ratingCount: 902 },
  { id: 'hcmc-driver-25', name: 'Dũng V.', rating: 4.9, ratingCount: 2635 },
];

export const DRIVERS_BY_CITY: Record<City, Driver[]> = {
  sf: SF_DRIVERS,
  hcmc: HCMC_DRIVERS,
};

function pickIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}

/** Picks one driver from `city`'s own 25-driver pool. `random` is injectable — same pattern as `pickDeliveryMs` — so a test can assert the exact driver a seeded source lands on. */
export function pickDriver(city: City, random: () => number = Math.random): Driver {
  const pool = DRIVERS_BY_CITY[city];
  return pool[pickIndex(pool.length, random)];
}
