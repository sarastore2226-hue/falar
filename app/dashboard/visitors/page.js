"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";

export default function VisitorsPage() {
  const router = useRouter();
  const [dailyVisitors, setDailyVisitors] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const employee = localStorage.getItem("employee");
    const employeeToken = localStorage.getItem("employeeToken");
    if (!employee || !employeeToken) {
      router.push("/login");
      return;
    }

    fetch("/api/visitors?details=true")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setTotal(Number(data.total) || 0);
        setDailyVisitors(Array.isArray(data.daily) ? data.daily : []);
      })
      .catch(() => {
        setTotal(0);
        setDailyVisitors([]);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const formatDate = (date) =>
    new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8" dir="rtl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              className="mb-4 text-sm font-semibold text-gray-500 hover:text-gray-900"
            >
              العودة إلى لوحة التحكم
            </button>
            <h1 className="text-3xl font-extrabold text-gray-900">تفاصيل الزوار</h1>
            <p className="mt-2 text-gray-600">عدد الزيارات المسجلة لكل يوم</p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-white px-6 py-4 text-center shadow-sm">
            <p className="text-sm text-gray-500">إجمالي الزوار</p>
            <p className="mt-1 text-3xl font-black text-indigo-600">
              {total.toLocaleString("ar-EG")}
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-indigo-50 px-6 py-4">
            <h2 className="font-bold text-gray-900">السجل اليومي</h2>
          </div>
          {loading ? (
            <p className="p-8 text-center text-gray-500">جاري تحميل بيانات الزوار...</p>
          ) : dailyVisitors.length === 0 ? (
            <p className="p-8 text-center text-gray-500">لا توجد زيارات مسجلة بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-sm text-gray-600">
                  <tr>
                    <th className="px-6 py-4 font-bold">التاريخ</th>
                    <th className="px-6 py-4 font-bold">عدد الزوار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailyVisitors.map((day) => (
                    <tr key={day.date} className="transition hover:bg-indigo-50/50">
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {formatDate(day.date)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex min-w-16 justify-center rounded-full bg-indigo-100 px-3 py-1 font-bold text-indigo-700">
                          {Number(day.count).toLocaleString("ar-EG")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
