"use client";

import { useEffect, useState } from "react";
import { getActivePromotions } from "./promotion-cache";
import Link from "next/link";

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

  if (all) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {promotions.map((promotion) => (
          <Link
            key={promotion.id}
            href={`/categories/${promotion.category?.id || promotion.category_id}`}
            className="block rounded-xl border-2 border-red-300 bg-red-50 p-5 text-red-800 shadow-sm transition hover:-translate-y-1 hover:border-red-500 hover:shadow-md"
          >
            <p className="text-xl font-extrabold">{promotion.name}</p>
            <p className="mt-2 font-bold">
              التصنيف: {promotion.category?.name}
            </p>
            <div className="mt-3 space-y-1 text-sm font-semibold">
              {promotion.tiers.map((tier) => (
                <p key={tier.id}>
                  {tier.min_quantity} قطع بـ {Number(tier.bundle_price).toLocaleString()} ج.م
                </p>
              ))}
            </div>
            <p className="mt-4 text-sm font-bold">اضغط للذهاب إلى التصنيف والاستفادة من العرض</p>
          </Link>
        ))}
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
