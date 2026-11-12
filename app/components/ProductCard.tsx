"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDisplay } from "../../context/DisplayContext";
import { useLanguage } from "../../context/LanguageContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PromotionNotice from "./PromotionNotice";

const PIECES_PER_SERIA = 4;

interface Product {
  modelId: string;
  price: number;
  category: string;
  description: string;
  group_name?: string;
  kind_name?: string;
  item_name?: string;
  master_code?: string;
  variants: Array<{
    id: string;
    color: string;
    imageUrl: string;
    sizes: string[];
    cur_qty?: number;
    stor_id?: number;
    totalColorQuantity?: number;
    sizeQuantities?: { [size: string]: number };
  }>;
  cur_qty?: number;
  stor_id?: number;
  item_code?: string;
  unique_id?: string;
}

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

const employeeQuantitiesCache: Map<string, number> = new Map();

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const { isEmployee } = useAuth();
  const { settings } = useDisplay();
  const { t, isArabic } = useLanguage();

  const [currentQuantity, setCurrentQuantity] = useState<number | null>(null);

  const totalStock = product.variants.reduce(
    (acc, variant) => acc + (variant.cur_qty || 0),
    0
  );

  useEffect(() => {
    const fetchEmployeeQuantities = async () => {
      if (!isEmployee) return;
      if (currentQuantity !== null) return;

      try {
        const cacheKey = `${product.modelId}`;
        if (employeeQuantitiesCache.has(cacheKey)) {
          setCurrentQuantity(employeeQuantitiesCache.get(cacheKey) || null);
          return;
        }

        const response = await fetch(
          `/api/products?employee=true&search=${
            product.master_code || product.modelId
          }`
        );

        if (response.ok) {
          const data = await response.json();
          const productsList = data.products || [];

          const employeeProduct = productsList.find(
            (p: Product) => p.modelId === product.modelId
          );

          if (employeeProduct) {
            const quantity = employeeProduct.cur_qty || 0;
            const finalQty =
              quantity === 0 && totalStock > 0 ? totalStock : quantity;

            setCurrentQuantity(finalQty);
            employeeQuantitiesCache.set(cacheKey, finalQty);
          } else {
            const fallbackQty = totalStock > 0 ? totalStock : 0;
            setCurrentQuantity(fallbackQty);
            employeeQuantitiesCache.set(cacheKey, fallbackQty);
          }
        }
      } catch (error) {
        console.warn("⚠️ لا يمكن جلب كميات الموظف:", error);
        setCurrentQuantity(totalStock);
      }
    };

    if (isEmployee) {
      fetchEmployeeQuantities();
    }
  }, [
    isEmployee,
    product.modelId,
    product.master_code,
    totalStock,
    currentQuantity,
  ]);

  const getDisplayQuantity = () => {
    if (!isEmployee) return null;
    if (currentQuantity !== null) return currentQuantity;
    if (totalStock > 0) return totalStock;
    return product.cur_qty || 0;
  };

  const availableQuantity = getDisplayQuantity();
  const availableSeries =
    availableQuantity !== null
      ? Math.floor(availableQuantity / PIECES_PER_SERIA)
      : null;

  const getProductName = () => {
    const desc = product.description.trim();
    return desc.replace(/\s+/g, " ");
  };

  const mainImage =
    product.variants[currentImageIndex]?.imageUrl ||
    "https://via.placeholder.com/270x360/FFFFFF/666666?text=No+Image";

  const responsiveImage = mainImage.match(/^(.*)-(320|660|1024)\.webp$/i);
  const imageSrcSet = responsiveImage
    ? [320, 660, 1024]
        .map((size) => `${responsiveImage[1]}-${size}.webp ${size}w`)
        .join(", ")
    : undefined;

  const getQuantityColor = (qty: number | null) => {
    if (qty === null) return "bg-blue-100 text-blue-800 border-blue-200";
    if (qty === 0) return "bg-red-100 text-red-800 border-red-200";
    if (qty <= 5) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  const getQuantityText = (qty: number | null) => {
    if (qty === null) return isArabic ? "📥 جاري التحقق..." : "📥 Checking...";
    if (qty === 0) return isArabic ? "⛔ غير متوفر" : "⛔ Out of Stock";
    if (qty <= 5) return isArabic ? `⚠️ متبقي ${qty} سرية` : `⚠️ Last ${qty} series`;
    return isArabic ? `✅ متاح (${qty} سرية)` : `✅ In Stock (${qty} series)`;
  };

  const getColorHex = (colorName: string) => {
    const colorMap: { [key: string]: string } = {
      أحمر: "#ef4444",
      احمر: "#ef4444",
      أخضر: "#22c55e",
      أزرق: "#3b82f6",
      أصفر: "#eab308",
      اخضر: "#22c55e",
      ازرق: "#3b82f6",
      اصفر: "#eab308",
      وردي: "#ec4899",
      بنفسجي: "#8b5cf6",
      برتقالي: "#f97316",
      أسود: "#000000",
      اسود: "#000000",
      أبيض: "#ffffff",
      رمادي: "#6b7280",
      كحلي: "#1e3a8a",
      بيج: "#f5f5dc",
      كافيه: "#8B5A2B",
    };
    return colorMap[colorName] || "#6b7280";
  };

  const piecePrice = product.price;
  const seriaPrice = piecePrice * PIECES_PER_SERIA;

  return (
    <Link
      href={`/product/${product.modelId}`}
      className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden group h-full flex flex-col block"
      onClick={() => {
        sessionStorage.setItem(
          `product-preview:${product.modelId}`,
          JSON.stringify(product)
        );
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mainImage}
          srcSet={imageSrcSet}
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          alt={getProductName()}
          width="660"
          height="880"
          className="w-full h-full object-contain transition-transform duration-300 ease-in-out group-hover:scale-105"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />

        <div className="absolute top-3 left-3 bg-indigo-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-black z-20">
          جملة (سرايا)
        </div>

        {isEmployee && (
          <div
            className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold border ${getQuantityColor(
              availableSeries
            )} shadow-sm z-20`}
          >
            {getQuantityText(availableSeries)}
          </div>
        )}

        {product.variants.length > 1 && (
          <div
            className={`absolute bottom-4 left-4 right-4 transition-all duration-300 z-20 ${
              isHovered
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-90"
            }`}
          >
            <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 shadow-xl border border-white/20">
              <div className="flex flex-col space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-700">
                    {isArabic ? "الألوان المتاحة:" : "Available Colors:"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {product.variants.length} {isArabic ? "لون" : "colors"}
                  </span>
                </div>

                <div className="flex justify-center space-x-3 space-x-reverse">
                  {product.variants.slice(0, 5).map((variant, index) => (
                    <button
                      key={variant.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCurrentImageIndex(index);
                      }}
                      className={`relative group/color transition-all duration-300 ${
                        currentImageIndex === index
                          ? "transform scale-125"
                          : "hover:scale-110"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full border-2 transition-all duration-300 shadow-md ${
                          currentImageIndex === index
                            ? "border-gray-900 shadow-lg"
                            : "border-white group-hover/color:border-gray-300"
                        }`}
                        style={{
                          backgroundColor: getColorHex(variant.color),
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3
              className="text-sm font-semibold line-clamp-2 flex-1 pr-2 leading-tight"
              style={{ color: settings.fontColor }}
            >
              {getProductName()}
            </h3>
          </div>

          <PromotionNotice
            category={product.category}
            product={product.description}
            compact
          />

          <p className="text-[11px] text-gray-400 font-mono">
            موديل: {product.master_code || product.modelId}
          </p>
        </div>

        <div className="pt-2 border-t border-gray-100 flex justify-between items-end">
          <div>
            <span className="text-xs text-gray-400 block font-medium">سعر القطعة</span>
            <span
              className="text-lg font-bold whitespace-nowrap"
              style={{ color: settings.fontColor }}
            >
              {piecePrice} {t("ج.م")}
            </span>
          </div>

          <div className="text-left">
            <span className="text-[10px] text-gray-400 block font-medium">السرية (4 قطع)</span>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              {seriaPrice} {t("ج.م")}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            router.push(`/product/${product.modelId}`);
          }}
          className="mt-auto w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center justify-center space-x-2 space-x-reverse shadow-md bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
        >
          <span>📦</span>
          <span>{t("عرض التفاصيل والطلب")}</span>
        </button>
      </div>
    </Link>
  );
}