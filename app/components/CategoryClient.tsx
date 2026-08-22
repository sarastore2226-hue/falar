"use client";

import { useState, useEffect } from "react";
import Header from "./Header";
import ProductCard from "./ProductCard";
import Pagination from "./Pagination";

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

        {/* Sub Categories */}
        {subCategories.length > 0 && (
          <div className="flex overflow-x-auto gap-4 mb-8 pb-4">
            {subCategories.map((sub: any) => (
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