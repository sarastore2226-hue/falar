"use client";

import { useState, useEffect } from "react";

interface CompanyInfo {
  id: number;
  company_name: string;
  address: string | null;
  logo: string | null;
  email: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  phone1: string | null;
  phone2: string | null;
  phone3: string | null;
  terms_conditions: string | null;
}

export function useCompanyInfo() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompanyInfo() {
      try {
        setLoading(true);
        setError(null); // ⬅️ إعادة تعيين الخطأ عند محاولة جديدة

        const response = await fetch("/api/company", {
          // ⬅️ إضافة cache control للأداء
          next: { revalidate: 3600 }, // إعادة التحقق كل ساعة
        });

        if (!response.ok) {
          throw new Error(`فشل في جلب بيانات الشركة: ${response.status}`);
        }

        const data = await response.json();
        setCompanyInfo(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "حدث خطأ غير متوقع";
        setError(errorMessage);
        console.error("Error fetching company info:", err);

        setCompanyInfo(null);
      } finally {
        setLoading(false);
      }
    }

    fetchCompanyInfo();
  }, []);

  // ⬅️ دالة لتحديث البيانات يدوياً
  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/company", {
        cache: "no-store", // ⬅️ تجاهل cache
      });

      if (!response.ok) {
        throw new Error(`فشل في تحديث بيانات الشركة: ${response.status}`);
      }

      const data = await response.json();
      setCompanyInfo(data);
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    companyInfo,
    loading,
    error,
    refetch, // ⬅️ تصدير دالة التحديث
  };
}
