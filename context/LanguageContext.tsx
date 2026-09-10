"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import translationsData from "@/lib/translations.json";

type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  isArabic: boolean;
  isEnglish: boolean;
  t: (keyOrText: string) => string;
}

type TranslationNode = string | { [key: string]: TranslationNode };
const translations = translationsData as Record<string, TranslationNode>;

// قاموس شامل لترجمة الكلمات والتصنيفات المركبة
const directTranslations: Record<string, string> = {
  // القوائم والروابط العامة
  "الرئيسية": "Home",
  "التصنيفات": "Categories",
  "جميع التصنيفات": "All Categories",
  "اتصل بنا": "Contact Us",
  "السلة": "Cart",
  "سلة التسوق": "Shopping Cart",
  "سلة التسوق فارغة": "Your cart is empty",
  "لوحة التحكم": "Dashboard",
  "لوحة تحكم المدير": "Manager Dashboard",
  "لوحة تحكم الموظف": "Employee Dashboard",
  "لوحتي": "My Dashboard",
  "وضع الموظف": "Employee Mode",
  "تسجيل الدخول": "Login",
  "تسجيل الخروج": "Logout",
  "التسجيل": "Register",
  "البحث": "Search",
  "ابحث عن منتج...": "Search products...",

  // الأقسام والصفحة الرئيسية
  "أحدث الموديلات": "Latest Models",
  "التصنيف حسب النوع": "Browse by Type",
  "عرض التفاصيل": "View Details",
  "لا توجد منتجات للعرض": "No products to display",

  // التصنيفات الفردية
  "شتوي": "Winter",
  "صيفي": "Summer",
  "أولاد": "Boys",
  "ولادي": "Boys",
  "بنات": "Girls",
  "بناتي": "Girls",
  "أطفال": "Kids",
  "بيبي": "Baby",
  "مواليد": "Newborn",
  "حديثي الولادة": "Newborn",
  "محير": "Teens",

  // ✅ التصنيفات المركبة المطلوبة للهيدر
  "بناتي صيفي": "Girls Summer",
  "بناتي شتوي": "Girls Winter",
  "بنات صيفي": "Girls Summer",
  "بنات شتوي": "Girls Winter",
  "ولادي صيفي": "Boys Summer",
  "ولادي شتوي": "Boys Winter",
  "أولاد صيفي": "Boys Summer",
  "أولاد شتوي": "Boys Winter",
  "أطفال صيفي": "Kids Summer",
  "أطفال شتوي": "Kids Winter",

  // بطاقة المنتج وتفاصيله
  "أضف إلى السلة": "Add to Cart",
  "أضف للسلة": "Add to Cart",
  "متوفر": "In Stock",
  "غير متوفر": "Out of Stock",
  "نفذت الكمية": "Out of Stock",
  "السعر": "Price",
  "الكمية": "Quantity",
  "المقاس": "Size",
  "المقاسات": "Sizes",
  "اللون": "Color",
  "الألوان": "Colors",
  "الألوان المتاحة": "Available Colors",
  "لون": "color",
  "مقاس": "size",

  // العروض والخصومات
  "خصم": "Discount",
  "خصومات": "Discounts",
  "عرض خاص": "Special Offer",
  "عروض": "Promotions",
  "عروض وخصومات": "Offers & Discounts",
  "تسوق واستفد من العرض": "Shop & Enjoy the Offer",

  // السلة والشراء والعملة
  "المجموع": "Total",
  "إتمام الشراء": "Checkout",
  "متابعة التسوق": "Continue Shopping",
  "الذهاب إلى السلة": "Go to Cart",
  "ج.م": "EGP",
  "جنيه": "EGP",
  "منتج": "product",
  "منتجات أخرى": "more items",
};

const DEFAULT_VALUE: LanguageContextType = {
  language: "ar",
  toggleLanguage: () => {},
  setLanguage: () => {},
  isArabic: true,
  isEnglish: false,
  t: (keyOrText: string) => keyOrText,
};

const LanguageContext = createContext<LanguageContextType>(DEFAULT_VALUE);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");

  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem("language") as Language | null;
      if (savedLanguage === "ar" || savedLanguage === "en") {
        setLanguageState(savedLanguage);
        document.documentElement.lang = savedLanguage;
        document.documentElement.dir = savedLanguage === "ar" ? "rtl" : "ltr";
      } else {
        document.documentElement.lang = "ar";
        document.documentElement.dir = "rtl";
      }
    } catch {
      // تفادي أخطاء التخزين
    }
  }, []);

  const toggleLanguage = () => {
    const newLanguage: Language = language === "ar" ? "en" : "ar";
    setLanguage(newLanguage);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("language", lang);
      if (typeof document !== "undefined") {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
      }
    } catch {
      // تجاهل أخطاء الحفظ
    }
  };

  // دالة الترجمة الذكية المزدوجة
  const t = (keyOrText: string): string => {
    if (!keyOrText) return "";
    const trimmed = keyOrText.trim();

    // 1. في حال كانت اللغة عربية
    if (language === "ar") {
      if (trimmed.includes(".")) {
        try {
          const keys = trimmed.split(".");
          let current: TranslationNode | undefined = translations["ar"];
          for (const k of keys) {
            if (current && typeof current === "object" && k in current) {
              current = current[k];
            } else {
              return trimmed;
            }
          }
          return typeof current === "string" ? current : trimmed;
        } catch {
          return trimmed;
        }
      }
      return keyOrText;
    }

    // 2. في حال كانت اللغة إنجليزية
    // أ) فحص القاموس المباشر للجملة الكاملة
    if (directTranslations[trimmed]) {
      return directTranslations[trimmed];
    }

    // ب) فحص ملف الترجمات إذا كان مفتاحاً مثل common.home
    try {
      const keys = trimmed.split(".");
      let current: TranslationNode | undefined = translations["en"];
      for (const k of keys) {
        if (current && typeof current === "object" && k in current) {
          current = current[k];
        } else {
          break;
        }
      }
      if (typeof current === "string") {
        return current;
      }
    } catch {
      // تجاهل
    }

    // ج) ترجمة ذكية كلمة بكلمة في حال كانت جملة مركبة من عدة كلمات عربية
    const words = trimmed.split(/\s+/);
    if (words.length > 1) {
      const translatedWords = words.map((word) => directTranslations[word] || word);
      return translatedWords.join(" ");
    }

    return keyOrText;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        toggleLanguage,
        setLanguage,
        isArabic: language === "ar",
        isEnglish: language === "en",
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context ?? DEFAULT_VALUE;
}