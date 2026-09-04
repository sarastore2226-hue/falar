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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {promotions.map((promotion) => (
          <Link
            key={promotion.id}
            href={`/categories/${promotion.category?.id || promotion.category_id}`}
            className="group relative block overflow-hidden rounded-2xl border border-red-200 bg-white shadow-[0_12px_30px_rgba(185,28,28,0.12)] transition duration-300 hover:-translate-y-1 hover:border-red-400 hover:shadow-[0_18px_38px_rgba(185,28,28,0.2)]"
          >
            <div className="h-2 bg-red-600" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-700">
                  عرض خاص
                </span>
                <span className="text-2xl font-black text-red-200">%</span>
              </div>
              <p className="mt-4 text-xl font-black leading-tight text-gray-900">
                {promotion.name}
              </p>
              <p className="mt-2 text-sm font-bold text-red-700">
                على تصنيف {promotion.category?.name}
              </p>
              <div className="mt-5 space-y-2">
                {promotion.tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-800"
                  >
                    <span>{tier.min_quantity} قطع</span>
                    <span>{Number(tier.bundle_price).toLocaleString()} ج.م</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm font-extrabold text-red-700">
                <span>تسوق واستفد من العرض</span>
                <span className="text-lg transition-transform duration-300 group-hover:-translate-x-1">←</span>
              </div>
            </div>
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
