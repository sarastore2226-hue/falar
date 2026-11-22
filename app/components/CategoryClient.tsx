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
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
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
  const activeFiltersCount =
    (selectedSubCategory ? 1 : 0) +
    (selectedSize ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center bg-white/80 backdrop-blur-md hover:bg-white px-3.5 py-2 rounded-full shadow-sm border border-gray-200/80 transition-all font-bold text-sm"
            style={{ color: settings.fontColor }}
          >
            <span className="ml-1">{isArabic ? "←" : "→"}</span>
            <span>{isArabic ? "العودة" : "Back"}</span>
          </button>
          {isEmployee && (
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
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

        {/* Main-from-main Sub Categories (عرض عائم حديث) */}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-7 justify-items-center">
              {mainSubCategories.map((sub: CategoryItem) => (
                <Link
                  key={sub.id}
                  href={`/categories/${sub.id}`}
                  className="group relative flex flex-col items-center w-full max-w-[245px] transition-transform duration-500 ease-out hover:-translate-y-2"
                >
                  <div className="relative w-full aspect-[4/5] rounded-[2rem] bg-white/90 p-2 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.14)] ring-1 ring-black/5 backdrop-blur-md transition-all duration-500 group-hover:shadow-[0_26px_55px_-12px_rgba(59,130,246,0.22)]">
                    <div className="relative w-full h-full overflow-hidden rounded-[1.55rem] bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sub.image}
                        alt={sub.name}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                      <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/85 backdrop-blur-xl px-3 py-2.5 shadow-lg border border-white/80 transition-all duration-300 group-hover:bg-white">
                        <p
                          className="text-base md:text-lg font-extrabold text-center truncate"
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

        {/* منصة الفلاتر الزجاجية العائمة الحديثة */}
        <div className="sticky top-[72px] z-30 mb-8">
          <div className="rounded-3xl bg-white/85 backdrop-blur-xl border border-white shadow-[0_14px_40px_-10px_rgba(15,23,42,0.14)] ring-1 ring-black/5 p-3 sm:p-4 space-y-3 transition-all">
            {/* الصف العلوي: البحث + زر إعادة التعيين + زر طي/فتح على الموبايل */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={
                    isArabic
                      ? "🔍 ابحث برقم الموديل أو الاسم..."
                      : "🔍 Search by model or name..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 rounded-2xl bg-gray-100/80 border border-gray-200/70 focus:bg-white focus:ring-2 focus:ring-pink-400 focus:outline-none text-xs sm:text-sm font-medium transition-all"
                  style={{ color: settings.fontColor }}
                />
              </div>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-3 py-2 rounded-2xl text-xs font-extrabold bg-red-50 text-red-600 border border-red-200/80 hover:bg-red-100 transition-colors shrink-0"
                >
                  {isArabic ? "مسح ✕" : "Clear ✕"}
                </button>
              )}

              {(leafSubCategories.length > 0 || availableSizes.length > 0) && (
                <button
                  type="button"
                  onClick={() => setIsFiltersExpanded((prev) => !prev)}
                  className="md:hidden px-3 py-2 rounded-2xl text-xs font-extrabold bg-white border border-gray-200 shadow-sm shrink-0 flex items-center gap-1"
                  style={{ color: settings.fontColor }}
                >
                  <span>{isFiltersExpanded ? "▲" : "▼"}</span>
                  <span>{isArabic ? "الفلاتر" : "Filters"}</span>
                  {activeFiltersCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] text-white"
                      style={{ backgroundColor: activeAccentColor }}
                    >
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* صفوف الفلاتر العائمة (النوع + المقاس) */}
            {(leafSubCategories.length > 0 || availableSizes.length > 0) && (
              <div
                className={`${
                  isFiltersExpanded ? "block" : "hidden md:block"
                } space-y-2.5 pt-1 border-t border-gray-100`}
              >
                {/* 1. فلتر التصنيفات الفرعية كشرائح عائمة بصور مصغرة + أيقونة الكل */}
                {leafSubCategories.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    <span
                      className="text-xs font-extrabold opacity-70 shrink-0 pl-1"
                      style={{ color: settings.fontColor }}
                    >
                      {isArabic ? "النوع:" : "Type:"}
                    </span>

                    {/* زر الكل للتصنيفات الفرعية */}
                    <button
                      type="button"
                      onClick={() => setSelectedSubCategory(null)}
                      className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-bold border transition-all whitespace-nowrap shrink-0 ${
                        selectedSubCategory === null
                          ? "shadow-md scale-[1.03]"
                          : "bg-white/90 hover:bg-white shadow-sm hover:shadow"
                      }`}
                      style={{
                        borderColor:
                          selectedSubCategory === null
                            ? activeAccentColor
                            : "#E5E7EB",
                        backgroundColor:
                          selectedSubCategory === null
                            ? activeAccentColor
                            : undefined,
                        color:
                          selectedSubCategory === null
                            ? "#FFFFFF"
                            : settings.fontColor,
                      }}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                          selectedSubCategory === null
                            ? "bg-white/25 text-white"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        ✦
                      </span>
                      <span>{isArabic ? "الكل" : "All"}</span>
                    </button>

                    {leafSubCategories.map((sub: CategoryItem) => {
                      const isActive = selectedSubCategory === sub.name;
                      return (
                        <button
                          type="button"
                          key={sub.id}
                          onClick={() => handleSubCategoryClick(sub.name)}
                          className={`flex items-center gap-2 rounded-full pl-3.5 pr-1.5 py-1 text-xs sm:text-sm font-bold border transition-all whitespace-nowrap shrink-0 ${
                            isActive
                              ? "shadow-md scale-[1.03]"
                              : "bg-white/90 hover:bg-white shadow-sm hover:shadow"
                          }`}
                          style={{
                            borderColor: isActive ? activeAccentColor : "#E5E7EB",
                            backgroundColor: isActive
                              ? activeAccentColor
                              : undefined,
                            color: isActive ? "#FFFFFF" : settings.fontColor,
                          }}
                        >
                          <span className="w-7 h-7 rounded-full overflow-hidden border border-white/70 bg-gray-100 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sub.image}
                              alt={sub.name}
                              className="w-full h-full object-cover"
                            />
                          </span>
                          <span>{t(sub.name)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. فلتر المقاسات المصغر العائم */}
                {availableSizes.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                    <span
                      className="text-xs font-extrabold opacity-70 shrink-0 pl-1"
                      style={{ color: settings.fontColor }}
                    >
                      📏 {isArabic ? "المقاس:" : "Size:"}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedSize(null)}
                      className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all whitespace-nowrap shrink-0 ${
                        selectedSize === null
                          ? "shadow-md scale-[1.03]"
                          : "bg-white/90 hover:bg-white shadow-sm hover:shadow"
                      }`}
                      style={{
                        borderColor:
                          selectedSize === null ? activeAccentColor : "#E5E7EB",
                        backgroundColor:
                          selectedSize === null ? activeAccentColor : undefined,
                        color:
                          selectedSize === null ? "#FFFFFF" : settings.fontColor,
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
                          className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all whitespace-nowrap shrink-0 ${
                            isActive
                              ? "shadow-md scale-[1.03]"
                              : "bg-white/90 hover:bg-white shadow-sm hover:shadow"
                          }`}
                          style={{
                            borderColor: isActive ? activeAccentColor : "#E5E7EB",
                            backgroundColor: isActive
                              ? activeAccentColor
                              : undefined,
                            color: isActive ? "#FFFFFF" : settings.fontColor,
                          }}
                        >
                          {displayLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
            <div className="font-medium" style={{ color: settings.fontColor }}>
              {isArabic
                ? "لا توجد منتجات مطابقة في هذا التصنيف"
                : "No matching products in this category"}
            </div>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-6 py-2.5 rounded-full text-sm font-bold text-white shadow-lg transition-all hover:scale-105"
                style={{ backgroundColor: activeAccentColor }}
              >
                {isArabic
                  ? "عرض جميع المنتجات (إزالة الفلاتر)"
                  : "Show All Products"}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}