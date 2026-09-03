import { PrismaClient } from "@prisma/client";

export type PromotionInputItem = {
  product: string;
  category?: string;
  quantity: number;
  price: number;
};

type Tier = { min_quantity: number; bundle_price: number };

export function calculateBundleTotal(quantity: number, baseTotal: number, tiers: Tier[]) {
  if (quantity <= 0 || tiers.length === 0) return baseTotal;

  const sorted = [...tiers]
    .filter((tier) => tier.min_quantity > 0 && tier.bundle_price >= 0)
    .sort((a, b) => a.min_quantity - b.min_quantity);
  const best = Array(quantity + 1).fill(Number.POSITIVE_INFINITY);
  best[0] = 0;

  for (let current = 1; current <= quantity; current += 1) {
    best[current] = baseTotal / quantity + best[current - 1];
    for (const tier of sorted) {
      if (tier.min_quantity <= current) {
        best[current] = Math.min(
          best[current],
          tier.bundle_price + best[current - tier.min_quantity]
        );
      }
    }
  }

  return Math.min(baseTotal, best[quantity]);
}

export async function pricePromotionItems(
  prisma: Pick<PrismaClient, "promotions">,
  items: PromotionInputItem[]
) {
  const grouped = new Map<string, {
    indexes: number[];
    quantity: number;
    baseTotal: number;
    productNames: string[];
  }>();

  items.forEach((item, index) => {
    const category = item.category?.trim();
    if (!category) return;
    const group = grouped.get(category) || {
      indexes: [],
      quantity: 0,
      baseTotal: 0,
      productNames: [],
    };
    group.indexes.push(index);
    if (item.product?.trim() && !group.productNames.includes(item.product.trim())) {
      group.productNames.push(item.product.trim());
    }
    group.quantity += Math.max(0, Number(item.quantity) || 0);
    group.baseTotal += (Number(item.price) || 0) * (Number(item.quantity) || 0);
    grouped.set(category, group);
  });

  const pricedItems = items.map((item) => ({
    ...item,
    finalUnitPrice: Number(item.price) || 0,
  }));
  let total = items.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );
  const appliedPromotions: Array<{
    name: string;
    category: string;
    quantity: number;
    total: number;
    savings: number;
  }> = [];

  for (const [category, group] of grouped) {
    const promotion = await prisma.promotions.findFirst({
      where: {
        active: true,
        OR: [
          { category: { name: category } },
          { category: { name: { in: group.productNames } } },
        ],
        AND: [
          { OR: [{ starts_at: null }, { starts_at: { lte: new Date() } }] },
          { OR: [{ ends_at: null }, { ends_at: { gte: new Date() } }] },
        ],
      },
      include: { tiers: true },
      orderBy: { created_at: "desc" },
    });
    if (!promotion) continue;

    const promotedTotal = calculateBundleTotal(
      group.quantity,
      group.baseTotal,
      promotion.tiers.map((tier) => ({
        min_quantity: tier.min_quantity,
        bundle_price: Number(tier.bundle_price),
      }))
    );
    if (promotedTotal >= group.baseTotal) continue;

    const ratio = group.baseTotal === 0 ? 0 : promotedTotal / group.baseTotal;
    group.indexes.forEach((index) => {
      pricedItems[index].finalUnitPrice = (Number(items[index].price) || 0) * ratio;
    });
    total -= group.baseTotal - promotedTotal;
    appliedPromotions.push({
      name: promotion.name,
      category,
      quantity: group.quantity,
      total: promotedTotal,
      savings: group.baseTotal - promotedTotal,
    });
  }

  return { items: pricedItems, total: Math.max(0, total), appliedPromotions };
}
