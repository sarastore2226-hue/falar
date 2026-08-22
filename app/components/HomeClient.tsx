"use client";

import React, { useState, useEffect, useMemo } from "react";
import Header from "./Header";
import ProductCard from "./ProductCard";
import Footer from "./Footer";
import Link from "next/link";

export default function HomeClient({ initialProducts, initialCategories }: any) {
  const [searchTerm, setSearchTerm] = useState("");
  const [displayProducts, setDisplayProducts] = useState(initialProducts.slice(0, 12));

  // ✅ تفعيل الوضع العشوائي عند التحميل فقط (لتحسين تجربة المستخدم)
  useEffect(() => {
    if (initialProducts.length > 0) {
      // خلط المنتجات عشوائياً بعد التحميل الأول
      const shuffled = [...initialProducts].sort(() => 0.5 - Math.random());
      setDisplayProducts(shuffled.slice(0, 12));
    }
  }, []); // تعمل مرة واحدة

  // ✅ الفلترة عند البحث
  useEffect(() => {
    if (searchTerm) {
      const filtered = initialProducts.filter((p: any) =>
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setDisplayProducts(filtered);
    }
  }, [searchTerm, initialProducts]);

  // ✅ تجهيز التصنيفات وصورة الهيرو
  const displayCategories = useMemo(() => {
    return initialCategories
      .filter((cat: any) => cat.kind === "جنس" && cat.name !== "خلفية" && cat.image)
      .slice(0, 8);
  }, [initialCategories]);

  const heroImage = useMemo(() => {
    return initialCategories.find((cat: any) => cat.name === "خلفية")?.image || "";
  }, [initialCategories]);

  // ✅ التحقق من الموظف (لإظهار الأزرار الخاصة)
  const [isEmployee, setIsEmployee] = useState(false);
  useEffect(() => {
    setIsEmployee(!!localStorage.getItem("employee"));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* نمرر دالة البحث للهيدر */}
      <Header onSearch={setSearchTerm} />

      {/* Hero Section */}
      <section
        className="relative w-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: heroImage
            ? `url(${heroImage})`
            : "linear-gradient(to right, #3b82f6, #8b5cf6)",
          aspectRatio: "3 / 1",
        }}
      ></section>

      {/* Categories Section */}
      {displayCategories.length > 0 && (
        <section className="py-16 bg-[#fdf6f8]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 text-center mb-12">
              التصنيف حسب النوع
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 justify-items-center">
              {displayCategories.map((cat: any, index: number) => (
                <Link key={cat.id} href={`/categories/${cat.id}`} className="group text-center block">
                  <div
                    className="bg-white rounded-[60px_20px_60px_20px] p-4 shadow-lg w-40 h-48 md:w-64 md:h-72 flex flex-col justify-end items-center overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 relative"
                    style={{ transform: `rotate(${index % 2 === 0 ? "-5deg" : "-5deg"})` }}
                  >
                    <div className="absolute inset-0 w-full h-full flex justify-center items-center">
                      <img src={cat.image} alt={cat.name} className="w-full h-full object-cover rounded-2xl" loading="lazy" />
                    </div>
                    <div className="relative z-10 w-full pt-32 md:pt-48">
                      <div className="bg-white/90 backdrop-blur-sm rounded-full mx-4 py-3 px-4 border border-white/50">
                        <p className="text-gray-800 text-lg font-bold">{cat.name}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products Section */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <section className="w-full">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">أحدث الموديلات</h1>
              <p className="text-gray-600 mt-1">
                {searchTerm ? `نتائج البحث: ${displayProducts.length}` : `عرض ${displayProducts.length} من أحدث المنتجات`}
              </p>
            </div>
            {isEmployee && (
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                👨‍💼 وضع الموظف
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {displayProducts.map((product: any, index: number) => (
              <ProductCard
                key={product.modelId}
                product={product}
                priority={index < 4}
              />
            ))}
          </div>
          
          {displayProducts.length === 0 && (
            <div className="text-center py-12 text-gray-500">لا توجد منتجات للعرض</div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}