type Promotion = {
  id: number;
  name: string;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  category?: { name: string };
  tiers: Array<{ id: number; min_quantity: number; bundle_price: number }>;
};

let promotionsPromise: Promise<Promotion[]> | null = null;
let promotionsCachedAt = 0;
const PROMOTIONS_CACHE_TTL = 30_000;

export function getActivePromotions() {
  const cacheIsFresh = Date.now() - promotionsCachedAt < PROMOTIONS_CACHE_TTL;

  if (!promotionsPromise || !cacheIsFresh) {
    promotionsCachedAt = Date.now();
    promotionsPromise = fetch("/api/promotions?active=true")
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => []);
  }

  return promotionsPromise;
}