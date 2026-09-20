"use client";

import Link from "next/link";
import Header from "@/app/components/Header";

export default function OrderSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Header />
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-16 bg-white rounded-3xl shadow-xl max-w-2xl mx-auto p-8 border border-green-100">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-12 h-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
            تم الدفع وتأكيد طلبك بنجاح!
          </h1>
          <p className="text-gray-600 mb-8 text-base">
            شكراً لثقتك بمتجرنا. تم استلام قيمة الطلب وجاري تجهيزه للشحن فوراً.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
          >
            العودة للرئيسية ومتابعة التسوق
          </Link>
        </div>
      </div>
    </div>
  );
}