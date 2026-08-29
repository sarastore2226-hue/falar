"use client";

import { useState, useEffect } from "react";
import Header from "./Header";
import ProductCard from "./ProductCard";
import Pagination from "./Pagination";
import Link from "next/link";

export default function CategoryClient({ 
  initialProducts, 
  categories, 
  currentCategory, 
  subCategories 
}: any) {
  
  const [products, setProducts] = useState(initialProducts);
  const [filteredProducts, setFilteredProducts] = useState(initialProducts);
  const [paginatedProducts, setPaginatedProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [isEmployee, setIsEmployee] = useState(false);

  // إعدادات الترقيم
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(12);

  // التحقق من الموظف
  useEffect(() => {
    setIsEmployee(!!localStorage.getItem("employee"));
  }, []);

  // تقسيم التصنيفات الفرعية:
  // - رئيسي من رئيسي (لديه تصنيفات فرعية) -> يُعرض بصور كبيرة وينقّل لصفحته
  // - فرعي (لا يملك تصنيفات) -> يظل كما هو (أزرار دائرية لفلترة المنتجات)
  const mainSubCategories = (subCategories || []).filter((sub: any) =>
    (categories || []).some((c: any) => c.sub === sub.name)
  );
  const leafSubCategories = (subCategories || []).filter((sub: any) =>
    !(categories || []).some((c: any) => c.sub === sub.name)
  );

  // منطق الفلترة (بحث + تصنيف فرعي)
  useEffect(() => {
    let result = [...products];

    // فلترة البحث
    if (searchTerm) {
      result = result.filter((p: any) => 
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.master_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // فلترة التصنيف الفرعي
    if (selectedSubCategory) {
        result = result.filter((p: any) => 
            p.description.toLowerCase().includes(selectedSubCategory.toLowerCase()) ||
            p.kind_name?.toLowerCase().includes(selectedSubCategory.toLowerCase())
        );
    }

    setFilteredProducts(result);
    setCurrentPage(1); // العودة للصفحة الأولى عند الفلترة
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
          <button onClick={() => window.history.back()} className="flex items-center text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg">
            العودة
          </button>
          {isEmployee && (
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">👔 وضع الموظف</span>
          )}
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentCategory?.name}</h1>
          <p className="text-gray-600">تصفح أحدث المنتجات</p>
        </div>

        {/* Main-from-main Sub Categories: صور كبيرة تنتقل لصفحة التصنيف */}
        {mainSubCategories.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">أقسام {currentCategory?.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 justify-items-center">
              {mainSubCategories.map((sub: any) => (
                <Link key={sub.id} href={`/categories/${sub.id}`} className="group text-center block">
                  <div className="bg-white rounded-[60px_20px_60px_20px] p-4 shadow-lg w-40 h-48 md:w-64 md:h-72 flex flex-col justify-end items-center overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 relative">
                    <div className="absolute inset-0 w-full h-full flex justify-center items-center">
                      <img src={sub.image} alt={sub.name} className="w-full h-full object-cover rounded-2xl" loading="lazy" />
                    </div>
                    <div className="relative z-10 w-full pt-32 md:pt-48">
                      <div className="bg-white/90 backdrop-blur-sm rounded-full mx-4 py-3 px-4 border border-white/50">
                        <p className="text-gray-800 text-lg font-bold text-center">{sub.name}</p>
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
            placeholder="ابحث في هذا التصنيف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Leaf Sub Categories: تظل كما هي كأزرار فلترة */}
        {leafSubCategories.length > 0 && (
          <div className="flex overflow-x-auto gap-4 mb-8 pb-4">
            {leafSubCategories.map((sub: any) => (
              <button
                key={sub.id}
                onClick={() => handleSubCategoryClick(sub.name)}
                className={`flex flex-col items-center min-w-[80px] ${selectedSubCategory === sub.name ? 'opacity-100 scale-110' : 'opacity-80'}`}
              >
                <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${selectedSubCategory === sub.name ? 'border-blue-600' : 'border-gray-200'}`}>
                  <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                </div>
                <span className="text-sm mt-2 font-medium">{sub.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Products Grid */}
        {paginatedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginatedProducts.map((product: any, index: number) => (
                <ProductCard
                  key={product.modelId}
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
          <div className="text-center py-12 text-gray-500">لا توجد منتجات في هذا التصنيف</div>
        )}
      </main>
    </div>
  );
}