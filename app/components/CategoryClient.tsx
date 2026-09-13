"use client";

import { useState, useEffect, type ComponentProps } from "react";
import Header from "./Header";
import ProductCard from "./ProductCard";
import Pagination from "./Pagination";
import Link from "next/link";
import { useDisplay } from "@/context/DisplayContext";
import { useLanguage } from "@/context/LanguageContext";

// تعريف الأنواع بدقة لمنع أخطاء ESLint (no-explicit-any)
type Product = ComponentProps<typeof ProductCard>["product"] & {
  modelId?: string | number;
  description?: string;
  category?: string;
  kind_name?: string;
  master_code?: string;
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

export default function CategoryClient({ 
  initialProducts = [], 
  categories = [], 
  currentCategory, 
  subCategories = [] 
}: CategoryClientProps) {
  const { settings } = useDisplay();
  const { t, isArabic } = useLanguage();
  
  const [products] = useState<Product[]>(initialProducts);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(initialProducts);
  const [paginatedProducts, setPaginatedProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [isEmployee, setIsEmployee] = useState(false);

  // إعدادات الترقيم
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 12;

  // التحقق من الموظف
  useEffect(() => {
    setIsEmployee(!!localStorage.getItem("employee"));
  }, []);

  // تقسيم التصنيفات الفرعية
  const isMainBranch = (sub: CategoryItem) =>
    sub.kind === "جنس" ||
    categories.some((c: CategoryItem) => c.sub === sub.name);

  const mainSubCategories = subCategories.filter(isMainBranch);
  const leafSubCategories = subCategories.filter((sub: CategoryItem) => !isMainBranch(sub));

  // منطق الفلترة (بحث + تصنيف فرعي)
  useEffect(() => {
    let result = [...products];

    // فلترة البحث
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((p: Product) => 
        (typeof p.description === "string" && p.description.toLowerCase().includes(term)) ||
        (typeof p.master_code === "string" && p.master_code.toLowerCase().includes(term))
      );
    }

    // فلترة التصنيف الفرعي
    if (selectedSubCategory) {
      const subTerm = selectedSubCategory.toLowerCase();
      result = result.filter((p: Product) => 
        (typeof p.description === "string" && p.description.toLowerCase().includes(subTerm)) ||
        (typeof p.kind_name === "string" && p.kind_name.toLowerCase().includes(subTerm))
      );
    }

    setFilteredProducts(result);
    setCurrentPage(1);
  }, [searchTerm, selectedSubCategory, products]);

  // منطق الترقيم
  useEffect(() => {
    const startIndex = (currentPage - 1) * limit;
    setPaginatedProducts(filteredProducts.slice(startIndex, startIndex + limit));
  }, [currentPage, limit, filteredProducts]);

  const handleSubCategoryClick = (name: string) => {
    setSelectedSubCategory(selectedSubCategory === name ? null : name);
  };

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
                <Link key={sub.id} href={`/categories/${sub.id}`} className="group text-center block">
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
            placeholder={isArabic ? "ابحث في هذا التصنيف..." : "Search in this category..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:outline-none text-sm"
            style={{ color: settings.fontColor }}
          />
        </div>

        {/* Leaf Sub Categories */}
        {leafSubCategories.length > 0 && (
          <div className="flex overflow-x-auto gap-4 mb-8 pb-4">
            {leafSubCategories.map((sub: CategoryItem) => (
              <button
                key={sub.id}
                onClick={() => handleSubCategoryClick(sub.name)}
                className={`flex flex-col items-center min-w-[80px] transition-all ${
                  selectedSubCategory === sub.name ? 'opacity-100 scale-110' : 'opacity-80'
                }`}
              >
                <div 
                  className="w-16 h-16 rounded-full overflow-hidden border-2 transition-colors"
                  style={{
                    borderColor: selectedSubCategory === sub.name 
                      ? (settings.storeIconColor || "#3B82F6") 
                      : "#E5E7EB"
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                </div>
                <span 
                  className="text-sm mt-2 font-medium"
                  style={{ color: settings.fontColor }}
                >
                  {t(sub.name)}
                </span>
              </button>
            ))}
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
                  hasNextPage={currentPage < Math.ceil(filteredProducts.length / limit)}
                  hasPrevPage={currentPage > 1}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        ) : (
          <div 
            className="text-center py-12 font-medium"
            style={{ color: settings.fontColor }}
          >
            {isArabic ? "لا توجد منتجات في هذا التصنيف" : "No products in this category"}
          </div>
        )}
      </main>
    </div>
  );
}