"use client";

import { useEffect, useState } from "react";
import { getActivePromotions } from "./promotion-cache";

type Promotion = Awaited<ReturnType<typeof getActivePromotions>> extends Array<infer Item>
  ? Item
  : never;

type PromotionNoticeProps = {
  category?: string;
  product?: string;
  all?: boolean;
  compact?: boolean;
};

export default function PromotionNotice({
  category,
  product,
  all = false,
  compact = false,
}: PromotionNoticeProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    let cancelled = false;
    getActivePromotions().then((data: Promotion[]) => {
        if (cancelled) return;
        const activePromotions = data.filter(
          (promotion) =>
            promotion.active &&
            (!promotion.starts_at || new Date(promotion.starts_at) <= new Date()) &&
            (!promotion.ends_at || new Date(promotion.ends_at) >= new Date()) &&
            (all ||
              promotion.category?.name?.trim() === category?.trim() ||
              promotion.category?.name?.trim() === product?.trim())
        );
        setPromotions(activePromotions);
      })

    return () => {
      cancelled = true;
    };
  }, [all, category, product]);

  if (promotions.length === 0) return null;

  if (compact) {
    return (
      <div className="mb-3 inline-flex items-center rounded-md border border-red-300 bg-red-50 px-3 py-1 text-sm font-bold text-red-700">
        خصومات
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-800">
      <p className="text-lg font-extrabold">عروض وخصومات خاصة متاحة الآن</p>
      <div className="mt-2 space-y-1 text-base font-semibold">
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
