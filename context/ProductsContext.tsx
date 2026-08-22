"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";

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
  }>;
  cur_qty?: number;
  stor_id?: number;
  item_code?: string;
  unique_id?: string;
}

interface Category {
  id: number;
  name: string;
  image: string;
  kind: string;
  sub?: string;
}

interface ProductsContextType {
  products: Product[];
  categories: Category[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  loading: boolean;
  error: string;
  refetchData: () => void;
}

const ProductsContext = createContext<ProductsContextType | undefined>(
  undefined
);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ دالة للتحقق من حالة الموظف
  const checkIsEmployee = () => {
    if (typeof window === "undefined") return false;
    try {
      const employee = localStorage.getItem("employee");
      const employeeToken = localStorage.getItem("employeeToken");
      return !!(employee && employeeToken);
    } catch {
      return false;
    }
  };

  // ✅ دالة جلب البيانات المحسنة
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const isEmployee = checkIsEmployee();

      const isFilteredCategoryPage =
        pathname.startsWith("/category/gender/") ||
        pathname.startsWith("/category/type/") ||
        pathname.startsWith("/categories/");

      if (isFilteredCategoryPage) {
        const response = await fetch("/api/categories");
        if (!response.ok) throw new Error(`فشل الاتصال: ${response.status}`);
        setCategories(await response.json());
        setProducts([]);
        return;
      }
      
      // ✅ استخدام الـ API الموحد السريع مع تحديد limit
      // نطلب 100 منتج فقط للصفحة الرئيسية لضمان السرعة القصوى
      // (يمكن زيادة الرقم في صفحات العرض الكاملة)
      const endpoint = `/api/getAllData?employee=${isEmployee}&limit=100`;

      console.log("🌐 جلب البيانات من:", endpoint);

      const response = await fetch(endpoint, {
        cache: 'no-store' // لضمان البيانات الطازجة
      });

      if (!response.ok) {
        throw new Error(`فشل الاتصال: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "فشل في تحميل البيانات");
      }

      // ✅ البيانات تأتي جاهزة من الـ API المحسن، لا داعي لإعادة تشكيلها هنا
      // الـ API يرسلها بالتنسيق الصحيح (products & categories)
      
      setProducts(data.products || []);
      setCategories(data.categories || []);
      
      console.log(`✅ تم تحميل ${data.products.length} منتج بنجاح`);

    } catch (err: unknown) {
      console.error("❌ Error fetching data:", err);
      setError("حدث خطأ في الاتصال بالخادم. يرجى المحاولة مرة أخرى.");
      // لا نستخدم بيانات وهمية لتجنب تضليل المستخدم
      setProducts([]); 
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  // ✅ دالة إعادة الجلب اليدوية
  const refetchData = () => {
    fetchData();
  };

  // ✅ الجلب الأولي
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ✅ الاستماع لتغييرات تسجيل الدخول
  useEffect(() => {
    const handleStorageChange = () => {
      // إعادة الجلب فقط إذا تغيرت حالة الموظف
      fetchData();
    };

    window.addEventListener("storage", handleStorageChange);
    
    // مراقبة التغييرات المحلية
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
      originalSetItem.apply(this, [key, value]);
      if (key === "employee" || key === "employeeToken") {
        fetchData();
      }
    };

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      localStorage.setItem = originalSetItem;
    };
  }, [fetchData]);

  const value: ProductsContextType = {
    products,
    categories,
    searchTerm,
    setSearchTerm,
    loading,
    error,
    refetchData,
  };

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    throw new Error("useProducts must be used within a ProductsProvider");
  }
  return context;
}