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

export default function HomeClient({
  initialProducts = [],
  initialCategories = [],
}: HomeClientProps) {
  const { settings } = useDisplay();
  const { isArabic, t } = useLanguage();
  const { searchTerm } = useProducts();
  const [displayProducts, setDisplayProducts] = useState<Product[]>(() =>
    initialProducts.slice(0, 12)
  );

  useEffect(() => {
    if (initialProducts.length > 0) {
      const shuffled = [...initialProducts].sort(() => 0.5 - Math.random());
      setDisplayProducts(shuffled.slice(0, 12));
    }
  }, [initialProducts]);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = initialProducts.filter(
        (p: Product) =>
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
      .filter(
        (cat: Category) =>
          cat.kind === "جنس" && !cat.sub && cat.name !== "خلفية" && cat.image
      )
      .slice(0, 8);
  }, [initialCategories]);

  const heroImage = useMemo(() => {
    return (
      initialCategories.find((cat: Category) => cat.name === "خلفية")?.image ||
      ""
    );
  }, [initialCategories]);

  const [isEmployee, setIsEmployee] = useState(false);
  useEffect(() => {
    setIsEmployee(!!localStorage.getItem("employee"));
  }, []);

  const formatCategoryName = (name: string) => {
    if (isArabic) return name;
    const categoryTranslations: Record<string, string> = {
      أولاد: "Boys",
      ولادي: "Boys",
      بنات: "Girls",
      بناتي: "Girls",
      أطفال: "Kids",
      بيبي: "Baby",
      مواليد: "Newborn",
      شتوي: "Winter",
      صيفي: "Summer",
      محير: "Teens",
      "حديثي الولادة": "Newborn",
    };
    return categoryTranslations[name] || name;
  };

  const accentColor = settings.storeIconColor || "#ec4899";

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

      {/* Floating Categories Section */}
      {displayCategories.length > 0 && (
        <section className="relative py-14 md:py-20 bg-gradient-to-b from-[#fdf6f8] via-[#fffafb] to-gray-50 overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-3/4 rounded-full bg-pink-200/20 blur-3xl" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2
              className="text-3xl md:text-4xl font-extrabold text-center mb-10 md:mb-14 tracking-tight"
              style={{ color: settings.fontColor }}
            >
              {t("home.categorizeBy")}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-7 md:gap-8 justify-items-center">
              {displayCategories.map((cat: Category) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.id}`}
                  className="group relative flex flex-col items-center w-full max-w-[255px] transition-transform duration-500 ease-out hover:-translate-y-2.5"
                >
                  {/* البطاقة العائمة الزجاجية */}
                  <div className="relative w-full aspect-[4/5] rounded-[2rem] bg-white/90 p-2 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.14)] ring-1 ring-black/5 backdrop-blur-md transition-all duration-500 group-hover:shadow-[0_28px_60px_-12px_rgba(236,72,153,0.25)]">
                    <div className="relative w-full h-full overflow-hidden rounded-[1.55rem] bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />

                      {/* كبسولة اسم التصنيف العائمة */}
                      <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/85 backdrop-blur-xl px-3 py-2.5 shadow-lg border border-white/80 transition-all duration-300 group-hover:bg-white">
                        <p
                          className="text-base md:text-lg font-extrabold text-center truncate"
                          style={{ color: settings.fontColor }}
                        >
                          {formatCategoryName(cat.name)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* زر اضغط هنا العائم تحت التصنيف */}
                  <span
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-md px-4 py-1.5 text-xs md:text-sm font-extrabold shadow-[0_10px_24px_-6px_rgba(0,0,0,0.14)] border border-white ring-1 ring-black/5 transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_28px_-6px_rgba(0,0,0,0.2)]"
                    style={{ color: accentColor }}
                  >
                    <span>{isArabic ? "اضغط هنا" : "Click here"}</span>
                    <span className="transition-transform duration-300 group-hover:-translate-x-0.5">
                      {isArabic ? "←" : "→"}
                    </span>
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
              <h1
                className="text-2xl font-bold"
                style={{ color: settings.fontColor }}
              >
                {t("home.latest")}
              </h1>
              <p className="text-gray-600 mt-1">
                {searchTerm
                  ? isArabic
                    ? `نتائج البحث: ${displayProducts.length}`
                    : `Search results: ${displayProducts.length}`
                  : isArabic
                  ? `عرض ${displayProducts.length} من أحدث المنتجات`
                  : `Showing ${displayProducts.length} latest products`}
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