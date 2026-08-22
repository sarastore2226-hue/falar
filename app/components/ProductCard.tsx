"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
}

// ✅ سنخزن كميات الموظف في متغير خارجي
let employeeQuantitiesCache: Map<string, number> = new Map();

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // ✅ إضافة حالة تحميل الصورة
  const [isImageLoading, setIsImageLoading] = useState(true);

  const { isEmployee } = useAuth();

  // ✅ الحالة الافتراضية للكمية يجب أن تكون null ليتم حسابها لاحقاً
  const [currentQuantity, setCurrentQuantity] = useState<number | null>(null);

  // 🔥 1. حساب إجمالي المخزون من جميع الألوان المتاحة في البيانات
  // هذا يضمن أن الكارت يظهر "متوفر" إذا كان أي لون يحتوي على كمية
  const totalStock = product.variants.reduce(
    (acc, variant) => acc + (variant.cur_qty || 0),
    0
  );

  // ✅ جلب كميات الموظف عند تحميل المكون
  useEffect(() => {
    const fetchEmployeeQuantities = async () => {
      if (!isEmployee) return;

      // إذا كنا قد حددنا كمية يدوياً (بالضغط على لون)، لا تقم بالجلب
      if (currentQuantity !== null) return;

      try {
        const cacheKey = `${product.modelId}`;
        if (employeeQuantitiesCache.has(cacheKey)) {
          setCurrentQuantity(employeeQuantitiesCache.get(cacheKey) || null);
          return;
        }

        // ✅ استخدام API المنتجات لجلب أحدث البيانات
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
            // نستخدم الكمية القادمة من السيرفر، أو نستخدم المجموع المحسوب
            const quantity = employeeProduct.cur_qty || 0;

            // 🔥 تعديل: إذا كانت كمية السيرفر 0 ولكن لدينا مجموع محلي > 0، نستخدم المجموع المحلي
            // هذا يحل مشكلة ظهور "غير متوفر" بينما توجد ألوان
            const finalQty =
              quantity === 0 && totalStock > 0 ? totalStock : quantity;

            setCurrentQuantity(finalQty);
            employeeQuantitiesCache.set(cacheKey, finalQty);
          } else {
            // إذا لم يجد المنتج ولكن لدينا مخزون في الألوان، نعرض مخزون الألوان
            const fallbackQty = totalStock > 0 ? totalStock : 0;
            setCurrentQuantity(fallbackQty);
            employeeQuantitiesCache.set(cacheKey, fallbackQty);
          }
        }
      } catch (error) {
        console.warn("⚠️ لا يمكن جلب كميات الموظف:", error);
        // عند الخطأ، استخدم المجموع المحسوب
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

  // ✅ الحصول على الكمية للعرض
  const getDisplayQuantity = () => {
    if (!isEmployee) return null;

    // 1. إذا تم تحديد كمية (سواء من الـ API أو عند اختيار لون)، اعرضها
    if (currentQuantity !== null) {
      return currentQuantity;
    }

    // 2. 🔥 الحل الجذري: إذا لم تكن هناك كمية محددة، اعرض إجمالي مخزون كل الألوان
    // بدلاً من الاعتماد على product.cur_qty الذي قد يكون صفراً
    if (totalStock > 0) {
      return totalStock;
    }

    // 3. الملجأ الأخير
    return product.cur_qty || 0;
  };

  const availableQuantity = getDisplayQuantity();

  const getProductName = () => {
    const desc = product.description.trim();
    return desc.replace(/\s+/g, " ");
  };

  const mainImage =
    product.variants[currentImageIndex]?.imageUrl ||
    "https://via.placeholder.com/270x360/FFFFFF/666666?text=No+Image";

  const getQuantityColor = (qty: number | null) => {
    if (qty === null) return "bg-blue-100 text-blue-800 border-blue-200";
    if (qty === 0) return "bg-red-100 text-red-800 border-red-200";
    if (qty <= 5) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  const getQuantityText = (qty: number | null) => {
    if (qty === null) return "📥 جاري التحقق...";
    if (qty === 0) return "⛔ غير متوفر";
    if (qty <= 5) return `⚠️ آخر ${qty}`;
    return `✅ متوفر (${qty})`;
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
      اورنج: "#f97316",
      أسود: "#000000",
      اسود: "#000000",
      أبيض: "#ffffff",
      رمادي: "#6b7280",
      بني: "#a16207",
      ذهبي: "#f59e0b",
      فضي: "#94a3b8",
      كريم: "#fef3c7",
      سكري: "#f0f9ff",
      نيون: "#4ade80",
      تركواز: "#06b6d4",
      كحلي: "#1e3a8a",
      زيتي: "#3f6212",
      بيج: "#f5f5dc",
      نبيتي: "#800000",
      رصاصي: "#71717a",
      سيمون: "#ff7f50",
      موف: "#a855f7",
      جنزاري: "#008b8b",
      كشمير: "#e6a8d7",
      هافان: "#cd7f32",
      مسطردة: "#ffdb58",
      لبني: "#87CEFA",
      منت: "#98FF98",
    };
    return colorMap[colorName] || "#6b7280";
  };

  return (
    <Link
      href={`/product/${product.modelId}`}
      className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden group h-full flex flex-col block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        {/* ✅ Skeleton Loader: يظهر فقط أثناء تحميل الصورة */}
        {isImageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse z-10">
            <svg
              className="w-10 h-10 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* ✅ الصورة مع تأثير الانتقال الناعم */}
        <img
          src={mainImage}
          alt={getProductName()}
          className={`w-full h-full object-contain transition-all duration-700 ease-in-out group-hover:scale-110 
            ${
              isImageLoading
                ? "scale-110 blur-2xl grayscale opacity-0"
                : "scale-100 blur-0 grayscale-0 opacity-100"
            }`}
          loading="lazy"
          onLoad={() => setIsImageLoading(false)}
        />

        {isEmployee && (
          <div
            className={`absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-semibold border ${getQuantityColor(
              availableQuantity
            )} shadow-sm z-20`}
          >
            {getQuantityText(availableQuantity)}
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
                    الألوان المتاحة:
                  </span>
                  <span className="text-xs text-gray-500">
                    {product.variants.length} لون
                  </span>
                </div>

                <div className="flex justify-center space-x-3">
                  {product.variants.slice(0, 5).map((variant, index) => (
                    <button
                      key={variant.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        // ✅ عند تغيير اللون، نعيد حالة التحميل للصورة الجديدة
                        if (currentImageIndex !== index) {
                          setIsImageLoading(true);
                        }

                        setCurrentImageIndex(index);

                        // 🔥 تعديل هام: عند تغيير اللون، نعرض كمية هذا اللون فوراً
                        if (isEmployee) {
                          const variantQty = variant.cur_qty || 0;
                          setCurrentQuantity(variantQty);
                        }
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

                      {currentImageIndex === index && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm" />
                      )}

                      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover/color:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap">
                          {variant.color}
                          {isEmployee && variant.cur_qty !== undefined && (
                            <div className="text-xs opacity-75">
                              {variant.cur_qty} قطعة
                            </div>
                          )}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </button>
                  ))}

                  {product.variants.length > 5 && (
                    <div className="flex items-center">
                      <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded-full">
                        +{product.variants.length - 5}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1 pr-2 leading-tight">
            {getProductName()}
          </h3>
          <div className="flex flex-col items-end">
            <span className="text-lg font-bold text-blue-600 whitespace-nowrap">
              {product.price} ج.م
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-gray-500 mb-4">
          <span className="truncate bg-gray-100 px-2 py-1 rounded-full">
            {product.category}
          </span>
          {product.variants.length > 0 && (
            <div className="flex items-center space-x-1 space-x-reverse text-gray-600">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
              <span>{product.variants.length} لون</span>
            </div>
          )}
        </div>

        {product.variants[0]?.sizes && product.variants[0].sizes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.variants[0].sizes.slice(0, 4).map((size) => (
              <span
                key={size}
                className="px-2.5 py-1 bg-gray-50 text-gray-700 text-xs rounded-lg border border-gray-200 font-medium"
              >
                {size}
              </span>
            ))}
            {product.variants[0].sizes.length > 4 && (
              <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs rounded-lg font-medium">
                +{product.variants[0].sizes.length - 4}
              </span>
            )}
          </div>
        )}

        {isEmployee && availableQuantity !== null && (
          <div className="mt-2 mb-3">
            <div
              className={`text-xs px-3 py-2 rounded-lg ${getQuantityColor(
                availableQuantity
              )}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">المخزن:</span>
                <span>
                  {availableQuantity === 0
                    ? "غير متوفر"
                    : `${availableQuantity} قطعة`}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            router.push(`/product/${product.modelId}`);
          }}
          className="mt-auto w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center space-x-2 space-x-reverse shadow-md hover:shadow-lg transform hover:translate-y-[-1px] active:translate-y-0 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          <span>عرض التفاصيل</span>
        </button>
      </div>
    </Link>
  );
}
