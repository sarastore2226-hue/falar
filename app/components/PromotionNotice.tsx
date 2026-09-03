"use client";

import { useEffect, useState } from "react";

type Promotion = {
  id: number;
  name: string;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  category?: { name: string };
  tiers: Array<{ id: number; min_quantity: number; bundle_price: number }>;
};

type PromotionNoticeProps = {
  category?: string;
  all?: boolean;
};

export default function PromotionNotice({ category, all = false }: PromotionNoticeProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/promotions")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: Promotion[]) => {
        if (cancelled) return;
        const activePromotions = data.filter(
          (promotion) =>
            promotion.active &&
            (!promotion.starts_at || new Date(promotion.starts_at) <= new Date()) &&
            (!promotion.ends_at || new Date(promotion.ends_at) >= new Date()) &&
            (all || promotion.category?.name?.trim() === category?.trim())
        );
        setPromotions(activePromotions);
      })
      .catch(() => {
        if (!cancelled) setPromotions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [all, category]);

  if (promotions.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <p className="font-bold">عروض خاصة متاحة الآن</p>
      <div className="mt-2 space-y-1 text-sm">
        {promotions.map((promotion) => (
          <p key={promotion.id}>
            <span className="font-semibold">{promotion.name}</span>
            {promotion.category?.name ? ` على ${promotion.category.name}` : ""}: {" "}
            {promotion.tiers
              .map(
                (tier) =>
                  `${tier.min_quantity} قطع بـ ${Number(tier.bundle_price).toLocaleString()} ج.م`
              )
              .join("، ")}
            . أضف الكمية المطلوبة للسلة للاستفادة.
          </p>
        ))}
      </div>
    </div>
  );
}
