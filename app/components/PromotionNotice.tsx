"use client";

import { useEffect, useState } from "react";
import { useDisplay } from "@/context/DisplayContext";
import { useLanguage } from "@/context/LanguageContext";
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
  const { settings } = useDisplay();
  const { t, isArabic } = useLanguage();

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
    });

    return () => {
      cancelled = true;
    };
  }, [all, category, product]);

  if (promotions.length === 0) return null;

  // 1. الوضع المصغر (في بطاقات المنتجات)
  if (compact) {
    return (
      <div
        className="mb-3 inline-flex items-center rounded-md px-3 py-1 text-sm font-bold"
        style={{
          backgroundColor: `${settings.promotionIconColor}20`,
          borderColor: `${settings.promotionIconColor}80`,
          color: settings.promotionIconColor,
          border: `2px solid ${settings.promotionIconColor}80`,
        }}
      >
        {isArabic ? "خصومات" : "Discounts"}
      </div>
    );
  }

  // 2. الوضع الكامل (في الصفحة الرئيسية)
  if (all) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {promotions.map((promotion) => (
          <Link
            key={promotion.id}
            href={`/categories/${promotion.category?.id || promotion.category_id}`}
            className="group relative block overflow-hidden rounded-2xl bg-white shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(0,0,0,0.2)]"
            style={{
              border: `2px solid ${settings.promotionIconColor}40`,
            }}
          >
            {/* الخط العلوي */}
            <div
              className="h-2"
              style={{ backgroundColor: settings.promotionIconColor }}
            />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                {/* علامة "عرض خاص" */}
                <span
                  className="rounded-full px-3 py-1 text-xs font-extrabold"
                  style={{
                    backgroundColor: `${settings.promotionIconColor}20`,
                    color: settings.promotionIconColor,
                  }}
                >
                  {isArabic ? "عرض خاص" : "Special Offer"}
                </span>
                <span
                  className="text-2xl font-black"
                  style={{ color: `${settings.promotionIconColor}40` }}
                >
                  %
                </span>
              </div>
              
              {/* ✅ ترجمة اسم العرض هنا */}
              <p className="mt-4 text-xl font-black leading-tight text-gray-900">
                {t(promotion.name)}
              </p>

              <p
                className="mt-2 text-sm font-bold"
                style={{ color: settings.promotionIconColor }}
              >
                {isArabic
                  ? `على تصنيف ${t(promotion.category?.name || "")}`
                  : `On ${t(promotion.category?.name || "")} category`}
              </p>
              <div className="mt-5 space-y-2">
                {promotion.tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold"
                    style={{
                      backgroundColor: `${settings.promotionIconColor}10`,
                      border: `2px solid ${settings.promotionIconColor}30`,
                      color: settings.promotionIconColor,
                    }}
                  >
                    <span>
                      {tier.min_quantity} {isArabic ? "قطع" : "pcs"}
                    </span>
                    <span>
                      {Number(tier.bundle_price).toLocaleString()} {t("ج.م")}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="mt-5 flex items-center justify-between border-t pt-4 text-sm font-extrabold"
                style={{
                  borderTopColor: `${settings.promotionIconColor}20`,
                  color: settings.promotionIconColor,
                }}
              >
                <span>
                  {isArabic ? "تسوق واستفد من العرض" : "Shop & Enjoy the Offer"}
                </span>
                <span className="text-lg transition-transform duration-300 group-hover:translate-x-[-4px]">
                  {isArabic ? "←" : "→"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  // 3. الوضع الافتراضي
  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: `${settings.promotionIconColor}10`,
        borderColor: settings.promotionIconColor,
        color: settings.promotionIconColor,
        border: `2px solid ${settings.promotionIconColor}`,
      }}
    >
      <p className="text-lg font-extrabold">
        {isArabic
          ? "عروض وخصومات خاصة متاحة الآن"
          : "Special Offers & Discounts Available Now"}
      </p>
      <div className="mt-2 space-y-1 text-base font-semibold">
        {promotions.map((promotion) => (
          <p key={promotion.id}>
            {/* ✅ ترجمة اسم العرض هنا */}
            <span className="font-semibold">{t(promotion.name)}</span>
            {promotion.category?.name
              ? isArabic
                ? ` على ${t(promotion.category.name)}`
                : ` on ${t(promotion.category.name)}`
              : ""}
            :{" "}
            {promotion.tiers
              .map(
                (tier) =>
                  `${tier.min_quantity} ${
                    isArabic ? "قطع بـ" : "pcs for"
                  } ${Number(tier.bundle_price).toLocaleString()} ${t("ج.م")}`
              )
              .join(isArabic ? "، " : ", ")}
            {isArabic
              ? ". أضف الكمية المطلوبة للسلة للاستفادة."
              : ". Add the required quantity to cart to redeem."}
          </p>
        ))}
      </div>
    </div>
  );
}