"use client";

import { useState, useEffect, useMemo, type ComponentProps } from "react";
import Header from "./Header";
import ProductCard from "./ProductCard";
import Pagination from "./Pagination";
import Link from "next/link";
import { useDisplay } from "@/context/DisplayContext";
import { useLanguage } from "@/context/LanguageContext";

type Product = ComponentProps<typeof ProductCard>["product"] & {
  modelId?: string | number;
  description?: string;
  category?: string;
  kind_name?: string;
  master_code?: string;
  size?: string;
  [key: string]: unknown;
};

interface CategoryItem {
  id: string | number;
  name: string;
  kind?: string;
  sub?: string | null;
  image?: string;
  [key: string]: unknown;
}

interface CategoryClientProps {
  initialProducts: Product[];
  categories?: CategoryItem[];
  currentCategory?: CategoryItem;
  subCategories?: CategoryItem[];
}

interface EmployeeProductsApiResponse {
  success?: boolean;
  products?: Product[];
}

const SIZE_STAGE_ORDER = ["مواليد", "بيبي", "وسط", "محير", "شبابي"];

const SIZE_EN_LABELS: Record<string, string> = {
  مواليد: "Newborn",
  بيبي: "Baby",
  وسط: "Medium",
  محير: "Teens",
  شبابي: "Youth",
};

function getProductRawSize(product: Product): string {
  if (
    typeof product.size === "string" &&
    product.size.trim() !== "" &&
    product.size.trim() !== "ONE SIZE"
  ) {
    return product.size.trim();
  }

  const firstVariantSize = product.variants?.[0]?.sizes?.[0];
  if (
    typeof firstVariantSize === "string" &&
    firstVariantSize.trim() !== "" &&
    firstVariantSize.trim() !== "ONE SIZE"
  ) {
    return firstVariantSize.trim();
  }

  return "";
}

function extractShortSize(rawSize: string): string {
  const clean = rawSize.trim();
  if (!clean || clean === "ONE SIZE") return "";
  if (clean.includes("حديثي الولادة") || clean.includes("مواليد")) return "مواليد";
  if (clean.includes("بيبي")) return "بيبي";
  if (clean.includes("وسط")) return "وسط";
  if (clean.includes("محير")) return "محير";
  if (clean.includes("شبابي")) return "شبابي";
  return clean;
}

export default function CategoryClient({
  initialProducts = [],
  categories = [],
  currentCategory,
  subCategories = [],
}: CategoryClientProps) {
  const { settings } = useDisplay();
  const { t, isArabic } = useLanguage();

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [filteredProducts, setFilteredProducts] =
    useState<Product[]>(initialProducts);
  const [paginatedProducts, setPaginatedProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(
    null
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [loadingEmployeeProducts, setLoadingEmployeeProducts] = useState(false);

  // إعدادات الترقيم
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 12;

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  // التحقق من الموظف/الأدمن وجلب جميع المنتجات له (شاملة CLOSED برصيد 0)
  useEffect(() => {
    const hasEmployeeSession = Boolean(
      localStorage.getItem("employee") &&
        localStorage.getItem("employeeToken")
    );
    setIsEmployee(hasEmployeeSession);

    if (!hasEmployeeSession || !currentCategory?.name) return;

    let cancelled = false;
    setLoadingEmployeeProducts(true);

    fetch(
      `/api/products?employee=true&category=${encodeURIComponent(
        currentCategory.name
      )}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: EmployeeProductsApiResponse | null) => {
        if (!cancelled && data?.success && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch employee category products:", error);
      })
      .finally(() => {
        if (!cancelled) setLoadingEmployeeProducts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentCategory?.name]);

  // تقسيم التصنيفات الفرعية
  const isMainBranch = (sub: CategoryItem) =>
    sub.kind === "جنس" ||
    categories.some((c: CategoryItem) => c.sub === sub.name);

  const mainSubCategories = subCategories.filter(isMainBranch);
  const leafSubCategories = subCategories.filter(
    (sub: CategoryItem) => !isMainBranch(sub)
  );

  // استخراج المقاسات المختصرة المتوفرة في التصنيف الحالي
  const availableSizes = useMemo(() => {
    const uniqueSizes = new Set<string>();
    products.forEach((product) => {
      const shortSize = extractShortSize(getProductRawSize(product));
      if (shortSize) uniqueSizes.add(shortSize);
    });

    return Array.from(uniqueSizes).sort((a, b) => {
      const idxA = SIZE_STAGE_ORDER.indexOf(a);
      const idxB = SIZE_STAGE_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, "ar");
    });
  }, [products]);

  // منطق الفلترة المشتركة (بحث + تصنيف فرعي + مقاس)
  useEffect(() => {
    let result = [...products];

    // فلترة البحث
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p: Product) =>
          (typeof p.description === "string" &&
            p.description.toLowerCase().includes(term)) ||
          (typeof p.master_code === "string" &&
            p.master_code.toLowerCase().includes(term))
      );
    }

    // فلترة التصنيف الفرعي
    if (selectedSubCategory) {
      const subTerm = selectedSubCategory.toLowerCase();
      result = result.filter(
        (p: Product) =>
          (typeof p.description === "string" &&
            p.description.toLowerCase().includes(subTerm)) ||
          (typeof p.kind_name === "string" &&
            p.kind_name.toLowerCase().includes(subTerm))
      );
    }

    // فلترة المقاس المختصر
    if (selectedSize) {
      const sizeLower = selectedSize.toLowerCase();
      result = result.filter((p: Product) => {
        const rawSize = getProductRawSize(p);
        if (!rawSize) return false;
        return (
          extractShortSize(rawSize) === selectedSize ||
          rawSize.toLowerCase().includes(sizeLower)
        );
      });
    }

    setFilteredProducts(result);
    setCurrentPage(1);
  }, [searchTerm, selectedSubCategory, selectedSize, products]);

  // منطق الترقيم
  useEffect(() => {
    const startIndex = (currentPage - 1) * limit;
    setPaginatedProducts(filteredProducts.slice(startIndex, startIndex + limit));
  }, [currentPage, limit, filteredProducts]);

  const handleSubCategoryClick = (name: string) => {
    setSelectedSubCategory(selectedSubCategory === name ? null : name);
  };

  const handleSizeClick = (sizeLabel: string) => {
    setSelectedSize(selectedSize === sizeLabel ? null : sizeLabel);
  };

  const resetAllFilters = () => {
    setSelectedSubCategory(null);
    setSelectedSize(null);
    setSearchTerm("");
  };

  const activeAccentColor = settings.storeIconColor || "#3B82F6";

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors font-medium text-sm"
            style={{ color: settings.fontColor }}
          >
            <span className="ml-1">{isArabic ? "←" : "→"}</span>
            <span>{isArabic ? "العودة" : "Back"}</span>
          </button>
          {isEmployee && (
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              👔 {isArabic ? "وضع الموظف" : "Employee Mode"}
              {loadingEmployeeProducts ? "..." : ""}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-extrabold mb-2"
            style={{ color: settings.fontColor }}
          >
            {t(currentCategory?.name || "")}
          </h1>
          <p className="text-sm opacity-80" style={{ color: settings.fontColor }}>
            {isArabic ? "تصفح أحدث المنتجات" : "Browse latest products"}
          </p>
        </div>

        {/* Main-from-main Sub Categories */}
        {mainSubCategories.length > 0 && (
          <div className="mb-10">
            <h2
              className="text-2xl font-bold text-center mb-8"
              style={{ color: settings.fontColor }}
            >
              {isArabic
                ? `أقسام ${t(currentCategory?.name || "")}`
                : `${t(currentCategory?.name || "")} Sections`}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 justify-items-center">
              {mainSubCategories.map((sub: CategoryItem) => (
                <Link
                  key={sub.id}
                  href={`/categories/${sub.id}`}
                  className="group text-center block"
                >
                  <div className="bg-white rounded-[60px_20px_60px_20px] p-4 shadow-lg w-40 h-48 md:w-64 md:h-72 flex flex-col justify-end items-center overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 relative">
                    <div className="absolute inset-0 w-full h-full flex justify-center items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sub.image}
                        alt={sub.name}
                        className="w-full h-full object-cover rounded-2xl"
                        loading="lazy"
                      />
                    </div>
                    <div className="relative z-10 w-full pt-32 md:pt-48">
                      <div className="bg-white/90 backdrop-blur-sm rounded-full mx-4 py-3 px-4 border border-white/50">
                        <p
                          className="text-lg font-bold text-center"
                          style={{ color: settings.fontColor }}
                        >
                          {t(sub.name)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <input
            type="text"
            placeholder={
              isArabic ? "ابحث في هذا التصنيف..." : "Search in this category..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:outline-none text-sm"
            style={{ color: settings.fontColor }}
          />
        </div>

        {/* Leaf Sub Categories + أيقونة الكل */}
        {leafSubCategories.length > 0 && (
          <div className="flex overflow-x-auto gap-4 mb-5 pb-2 pt-1">
            {/* زر الكل للتصنيفات الفرعية */}
            <button
              type="button"
              onClick={() => setSelectedSubCategory(null)}
              className={`flex flex-col items-center min-w-[76px] transition-all ${
                selectedSubCategory === null
                  ? "opacity-100 scale-105"
                  : "opacity-75 hover:opacity-100"
              }`}
            >
              <div
                className="w-16 h-16 rounded-full overflow-hidden border-2 flex items-center justify-center shadow-sm transition-colors font-extrabold text-sm"
                style={{
                  borderColor:
                    selectedSubCategory === null
                      ? activeAccentColor
                      : "#E5E7EB",
                  backgroundColor:
                    selectedSubCategory === null
                      ? `${activeAccentColor}15`
                      : "#FFFFFF",
                  color:
                    selectedSubCategory === null
                      ? activeAccentColor
                      : settings.fontColor,
                }}
              >
                {isArabic ? "الكل" : "All"}
              </div>
              <span
                className="text-sm mt-2 font-bold"
                style={{
                  color:
                    selectedSubCategory === null
                      ? activeAccentColor
                      : settings.fontColor,
                }}
              >
                {isArabic ? "الكل" : "All"}
              </span>
            </button>

            {leafSubCategories.map((sub: CategoryItem) => (
              <button
                type="button"
                key={sub.id}
                onClick={() => handleSubCategoryClick(sub.name)}
                className={`flex flex-col items-center min-w-[80px] transition-all ${
                  selectedSubCategory === sub.name
                    ? "opacity-100 scale-105"
                    : "opacity-80 hover:opacity-100"
                }`}
              >
                <div
                  className="w-16 h-16 rounded-full overflow-hidden border-2 transition-colors"
                  style={{
                    borderColor:
                      selectedSubCategory === sub.name
                        ? activeAccentColor
                        : "#E5E7EB",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sub.image}
                    alt={sub.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span
                  className="text-sm mt-2 font-medium"
                  style={{
                    color:
                      selectedSubCategory === sub.name
                        ? activeAccentColor
                        : settings.fontColor,
                    fontWeight: selectedSubCategory === sub.name ? 700 : 500,
                  }}
                >
                  {t(sub.name)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* فلتر المقاسات المصغر (يعمل منفرداً أو مع التصنيف الفرعي) */}
        {availableSizes.length > 0 && (
          <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2">
            <span
              className="text-xs sm:text-sm font-bold shrink-0 px-1"
              style={{ color: settings.fontColor }}
            >
              📏 {isArabic ? "المقاس:" : "Size:"}
            </span>

            <button
              type="button"
              onClick={() => setSelectedSize(null)}
              className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all whitespace-nowrap shrink-0"
              style={{
                borderColor:
                  selectedSize === null ? activeAccentColor : "#E5E7EB",
                backgroundColor:
                  selectedSize === null ? activeAccentColor : "#FFFFFF",
                color: selectedSize === null ? "#FFFFFF" : settings.fontColor,
              }}
            >
              {isArabic ? "الكل" : "All"}
            </button>

            {availableSizes.map((sizeLabel) => {
              const isActive = selectedSize === sizeLabel;
              const displayLabel = isArabic
                ? sizeLabel
                : SIZE_EN_LABELS[sizeLabel] || sizeLabel;

              return (
                <button
                  type="button"
                  key={sizeLabel}
                  onClick={() => handleSizeClick(sizeLabel)}
                  className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all whitespace-nowrap shrink-0"
                  style={{
                    borderColor: isActive ? activeAccentColor : "#E5E7EB",
                    backgroundColor: isActive ? activeAccentColor : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : settings.fontColor,
                  }}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        )}

        {/* Products Grid */}
        {paginatedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginatedProducts.map((product: Product, index: number) => (
                <ProductCard
                  key={product.modelId ?? index}
                  product={product}
                  priority={index < 4}
                />
              ))}
            </div>

            {/* Pagination */}
            {filteredProducts.length > limit && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredProducts.length / limit)}
                  totalProducts={filteredProducts.length}
                  limit={limit}
                  hasNextPage={
                    currentPage < Math.ceil(filteredProducts.length / limit)
                  }
                  hasPrevPage={currentPage > 1}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 space-y-4">
            <div
              className="font-medium"
              style={{ color: settings.fontColor }}
            >
              {isArabic
                ? "لا توجد منتجات مطابقة في هذا التصنيف"
                : "No matching products in this category"}
            </div>
            {(selectedSubCategory || selectedSize || searchTerm) && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-5 py-2 rounded-full text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: activeAccentColor }}
              >
                {isArabic ? "عرض جميع المنتجات (إزالة الفلاتر)" : "Show All Products"}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}