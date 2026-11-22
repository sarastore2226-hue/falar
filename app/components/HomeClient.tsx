"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useDisplay } from "@/context/DisplayContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProducts } from "@/context/ProductsContext";
import Header from "./Header";
import ProductCard from "./ProductCard";
import Footer from "./Footer";
import Link from "next/link";
import PromotionNotice from "./PromotionNotice";

type Product = React.ComponentProps<typeof ProductCard>["product"] & {
  modelId?: string | number;
  description?: string;
  category?: string;
};

interface Category {
  id: string | number;
  name: string;
  kind?: string;
  sub?: string | boolean | null;
  image?: string;
}

interface HomeClientProps {
  initialProducts: Product[];
  initialCategories: Category[];
}

export default function HomeClient({ initialProducts = [], initialCategories = [] }: HomeClientProps) {
  const { settings } = useDisplay();
  const { isArabic, t } = useLanguage();
  const { searchTerm } = useProducts();
  const [displayProducts, setDisplayProducts] = useState<Product[]>(() => initialProducts.slice(0, 12));

  useEffect(() => {
    if (initialProducts.length > 0) {
      const shuffled = [...initialProducts].sort(() => 0.5 - Math.random());
      setDisplayProducts(shuffled.slice(0, 12));
    }
  }, [initialProducts]);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = initialProducts.filter((p: Product) =>
        (p.description && p.description.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term))
      );
      setDisplayProducts(filtered);
    } else {
      setDisplayProducts(initialProducts.slice(0, 12));
    }
  }, [searchTerm, initialProducts]);

  const displayCategories = useMemo(() => {
    return initialCategories
      .filter((cat: Category) => cat.kind === "جنس" && !cat.sub && cat.name !== "خلفية" && cat.image)
      .slice(0, 8);
  }, [initialCategories]);

  const heroImage = useMemo(() => {
    return initialCategories.find((cat: Category) => cat.name === "خلفية")?.image || "";
  }, [initialCategories]);

  const [isEmployee, setIsEmployee] = useState(false);
  useEffect(() => {
    setIsEmployee(!!localStorage.getItem("employee"));
  }, []);

  const formatCategoryName = (name: string) => {
    if (isArabic) return name;
    const categoryTranslations: Record<string, string> = {
      "أولاد": "Boys",
      "ولادي": "Boys",
      "بنات": "Girls",
      "بناتي": "Girls",
      "أطفال": "Kids",
      "بيبي": "Baby",
      "مواليد": "Newborn",
      "شتوي": "Winter",
      "صيفي": "Summer",
      "محير": "Teens",
      "حديثي الولادة": "Newborn",
    };
    return categoryTranslations[name] || name;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

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
            {/* عنوان قسم التصنيفات يتبع fontColor */}
            <h2 
              className="text-3xl md:text-4xl font-extrabold text-center mb-12" 
              style={{ color: settings.fontColor }}
            >
              {t("home.categorizeBy")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 justify-items-center">
              {displayCategories.map((cat: Category, index: number) => (
                <Link key={cat.id} href={`/categories/${cat.id}`} className="group text-center flex flex-col items-center">
                  <div
                    className="bg-white rounded-[60px_20px_60px_20px] p-4 shadow-lg w-40 h-48 md:w-64 md:h-72 flex flex-col justify-end items-center overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 relative"
                    style={{ transform: `rotate(${index % 2 === 0 ? "-5deg" : "-5deg"})` }}
                  >
                    <div className="absolute inset-0 w-full h-full flex justify-center items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={cat.image} 
                        alt={cat.name} 
                        className="w-full h-full object-cover rounded-2xl" 
                        loading="lazy" 
                      />
                    </div>
                    <div className="relative z-10 w-full pt-32 md:pt-48">
                      <div className="bg-white/90 backdrop-blur-sm rounded-full mx-4 py-3 px-4 border border-white/50">
                        {/* ✅ عنوان واسم التصنيف داخل الكارت أصبح يتبع fontColor */}
                        <p 
                          className="text-lg font-bold"
                          style={{ color: settings.fontColor }}
                        >
                          {formatCategoryName(cat.name)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span
                    className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-4 py-1 text-xs md:text-sm font-bold shadow-sm border border-pink-100 transition-all group-hover:scale-105 group-hover:shadow"
                    style={{ color: settings.storeIconColor || settings.fontColor }}
                  >
                    <span>{isArabic ? "اضغط هنا" : "Click here"}</span>
                    <span>{isArabic ? "←" : "→"}</span>
                  </span>
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
              <h1 className="text-2xl font-bold" style={{ color: settings.fontColor }}>
                {t("home.latest")}
              </h1>
              <p className="text-gray-600 mt-1">
                {searchTerm
                  ? (isArabic ? `نتائج البحث: ${displayProducts.length}` : `Search results: ${displayProducts.length}`)
                  : (isArabic ? `عرض ${displayProducts.length} من أحدث المنتجات` : `Showing ${displayProducts.length} latest products`)}
              </p>
            </div>
            {isEmployee && (
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                👨‍💼 {isArabic ? "وضع الموظف" : "Employee Mode"}
              </div>
            )}
          </div>

          <div className="mb-8">
            <PromotionNotice all />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {displayProducts.map((product: Product, index: number) => (
              <ProductCard
                key={product.modelId ?? index}
                product={product}
                priority={index < 4}
              />
            ))}
          </div>
          
          {displayProducts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t("home.noProducts")}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}