"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import Link from "next/link";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    productsWithImages: 0,
    productsWithoutImages: 0,
    categoriesCount: 0,
    visitorCount: 0, // ✅ تمت الإضافة: حالة جديدة لعدد الزوار
  });

  useEffect(() => {
    // التحقق من صلاحية الموظف (مدير أو موظف عادي)
    const checkEmployee = () => {
      try {
        const employee = localStorage.getItem("employee");
        const employeeToken = localStorage.getItem("employeeToken");

        if (!employee || !employeeToken) {
          router.push("/login");
          return;
        }

        const userData = JSON.parse(employee);

        // ✅ السماح للموظفين العاديين والمديرين
        if (userData.position !== "مدير" && userData.position !== "موظف") {
          router.push("/");
          return;
        }

        setUser(userData);
        fetchStats();
      } catch (error) {
        console.error("Error checking employee:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkEmployee();
  }, [router]);

  const fetchStats = async () => {
    try {
      // جلب إحصائيات حقيقية
      // ✅ تمت الإضافة: جلب عدد الزوار ضمن الـ Promise
      const [productsRes, usersRes, imagesStatsRes, categoriesRes, visitorsRes, ordersRes] =
        await Promise.all([
          fetch("/api/products"),
          fetch("/api/users"),
          fetch("/api/match-images"), // جلب إحصائيات الصور
          fetch("/api/categories"), // جلب التصنيفات
          fetch("/api/visitors"), // ✅ جلب عدد الزوار
          fetch("/api/orders"), // ✅ جلب الطلبات
        ]);

      const productsData = await productsRes.json();
      const usersData = await usersRes.json();
      const imagesStatsData = imagesStatsRes.ok
        ? await imagesStatsRes.json()
        : { statistics: {} };
      const categoriesData = categoriesRes.ok ? await categoriesRes.json() : [];
      // ✅ معالجة بيانات الزوار
      const visitorsData = visitorsRes.ok ? await visitorsRes.json() : { total: 0 };
      // ✅ جلب الطلبات وحساب العدد والإيرادات الفعليين
      const ordersData = ordersRes.ok ? await ordersRes.json() : [];
      const ordersList = Array.isArray(ordersData) ? ordersData : [];
      const totalOrders = ordersList.length;
      const totalRevenue = ordersList.reduce(
        (sum, order) => sum + (Number(order.total_price) || 0),
        0
      );

      const products = productsData.products || [];
      const productsWithImages = products.filter((p) => p.images).length;

      setStats({
        totalProducts: products.length,
        totalUsers: usersData?.length || 0,
        totalOrders: totalOrders,
        totalRevenue: totalRevenue,
        productsWithImages: productsWithImages,
        productsWithoutImages: products.length - productsWithImages,
        categoriesCount: categoriesData.length,
        visitorCount: visitorsData.total, // ✅ تحديث الحالة
        ...imagesStatsData.statistics,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // ✅ تحديث الإحصائيات فورياً عند وصول طلب جديد من الريال تايم
  useEffect(() => {
    const handleOrderCreated = () => {
      fetchStats();
    };

    window.addEventListener("order-created", handleOrderCreated);
    return () => {
      window.removeEventListener("order-created", handleOrderCreated);
    };
  }, []);

  // ✅ تحديد البطاقات بناءً على صلاحية المستخدم
  const getDashboardCards = () => {
    const isManager = user?.position === "مدير";
    const isEmployee = user?.position === "موظف";

    const baseCards = [
      // بطاقات تظهر للجميع (موظفين ومديرين)
      {
        title: "إدارة الطلبات",
        description: "عرض، طباعة وتصدير طلبات العملاء",
        icon: "📋",
        href: "/dashboard/orders",
        color: "from-orange-500 to-orange-600",
        bgColor: "bg-orange-50",
        count: `${stats.totalOrders} طلب`,
      },
    ];

    const managerCards = [
      // بطاقات تظهر للمدير فقط
      {
        title: "إدارة المنتجات",
        description: "إضافة، تعديل وحذف المنتجات والصور",
        icon: "📦",
        href: "/dashboard/products",
        color: "from-blue-500 to-blue-600",
        bgColor: "bg-blue-50",
        count: `${stats.totalProducts} منتج`,
      },
      {
        title: "إدارة التصنيفات",
        description: "إضافة، تعديل وحذف التصنيفات",
        icon: "📁",
        href: "/dashboard/categories",
        color: "from-indigo-500 to-indigo-600",
        bgColor: "bg-indigo-50",
        count: `${stats.categoriesCount} تصنيف`,
      },
      {
        title: "رفع الصور",
        description: "رفع الصور وربطها تلقائياً مع المنتجات",
        icon: "🖼️",
        href: "/dashboard/upload",
        color: "from-teal-500 to-teal-600",
        bgColor: "bg-teal-50",
        count: `${stats.productsWithImages}/${stats.totalProducts} صورة`,
      },
      {
        title: "إدارة الشركة",
        description: "تعديل معلومات المتجر والشعار",
        icon: "🏢",
        href: "/dashboard/company",
        color: "from-green-500 to-green-600",
        bgColor: "bg-green-50",
        count: "معلومات المتجر",
      },
      {
        title: "إدارة المستخدمين",
        description: "إدارة حسابات الموظفين والعملاء",
        icon: "👥",
        href: "/dashboard/users",
        color: "from-purple-500 to-purple-600",
        bgColor: "bg-purple-50",
        count: `${stats.totalUsers} مستخدم`,
      },
    ];

    if (isManager) {
      return [...baseCards, ...managerCards];
    } else if (isEmployee) {
      return baseCards; // الموظف العادي يرى إدارة الطلبات فقط
    }

    return [];
  };

  const dashboardCards = getDashboardCards();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">جاري التحقق من الصلاحيات...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* رأس الداشبورد */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">لوحة التحكم</h1>
              <p className="text-gray-600 mt-2">
                مرحباً بعودتك، {user.username} 👋
              </p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <p className="text-sm text-gray-600">الدور</p>
                <p
                  className={`text-lg font-semibold ${
                    user.position === "مدير"
                      ? "text-purple-600"
                      : "text-blue-600"
                  }`}
                >
                  {user.position}
                </p>
              </div>
              <button
                onClick={fetchStats}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                تحديث البيانات
              </button>
            </div>
          </div>
        </div>

        {/* إحصائيات سريعة - بيانات حقيقية */}
        {/* ✅ تم التعديل هنا: زيادة عدد الأعمدة لاستيعاب بطاقة الزوار */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          
          {/* ✅ بطاقة عدد الزوار الجديدة */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">إجمالي الزوار</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {stats.visitorCount ? stats.visitorCount.toLocaleString('ar-EG') : 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">زيارة للموقع</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👀</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">إجمالي المنتجات</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalProducts}
                </p>
                <p className="text-xs text-gray-500 mt-1">منتج في المتجر</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">الطلبات</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalOrders}
                </p>
                <p className="text-xs text-gray-500 mt-1">طلب من العملاء</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">المستخدمون</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalUsers}
                </p>
                <p className="text-xs text-gray-500 mt-1">مستخدم مسجل</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">التصنيفات</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.categoriesCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">تصنيف في المتجر</p>
              </div>
              <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📁</span>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ رسالة ترحيب خاصة بناءً على الصلاحية */}
        {user.position === "موظف" && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center ml-4">
                <span className="text-2xl">👨‍💼</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900">
                  مرحباً بك في لوحة الموظفين
                </h3>
                <p className="text-blue-700 mt-1">
                  يمكنك إدارة طلبات العملاء، طباعة الفواتير، وتصدير البيانات.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* بطاقات الداشبورد */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardCards.map((card, index) => (
            <Link key={index} href={card.href} className="block group">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 hover:border-blue-300 h-full">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-14 h-14 ${card.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}
                  >
                    <span className="text-2xl">{card.icon}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {card.count}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {card.description}
                </p>

                <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                  <span>بدء الإدارة</span>
                  <svg
                    className="w-4 h-4 mr-1 transform group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ✅ رسالة إذا لم يكن لدى الموظف أي صلاحيات */}
        {user.position === "موظف" && dashboardCards.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              لا توجد صلاحيات متاحة
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              ليس لديك صلاحيات للوصول إلى أي قسم من أقسام الإدارة. يرجى التواصل
              مع المدير لإضافة الصلاحيات المناسبة.
            </p>
          </div>
        )}

        {/* قسم سريع لرفع الصور (للمدير فقط) */}
        {user.position === "مدير" && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* إحصائيات الصور */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                📊 إحصائيات الصور
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">المنتجات ذات الصور:</span>
                  <span className="font-semibold text-green-600">
                    {stats.productsWithImages}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">المنتجات بدون صور:</span>
                  <span className="font-semibold text-orange-600">
                    {stats.productsWithoutImages}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">نسبة التغطية:</span>
                  <span className="font-semibold text-blue-600">
                    {stats.totalProducts > 0
                      ? `${Math.round(
                          (stats.productsWithImages / stats.totalProducts) * 100
                        )}%`
                      : "0%"}
                  </span>
                </div>
              </div>
            </div>

            {/* إجراءات سريعة */}
            <div className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl shadow-sm border border-blue-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                ⚡ إجراءات سريعة
              </h3>
              <div className="space-y-3">
                <Link
                  href="/dashboard/upload"
                  className="block w-full bg-blue-600 text-white text-center py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  🖼️ رفع صور جديدة
                </Link>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/match-images", {
                        method: "POST",
                      });
                      const result = await response.json();
                      if (result.success) {
                        alert(`✅ تم ربط ${result.matched} صورة مع المنتجات`);
                        fetchStats();
                      } else {
                        alert("❌ فشل في المطابقة: " + result.error);
                      }
                    } catch (error) {
                      alert("❌ خطأ في الاتصال");
                    }
                  }}
                  className="w-full bg-teal-600 text-white text-center py-3 px-4 rounded-lg hover:bg-teal-700 transition-colors font-medium"
                >
                  🔄 مطابقة الصور تلقائياً
                </button>
              </div>
            </div>
          </div>
        )}

        {/* نشاط حديث - بيانات حقيقية */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">النشاط الحديث</h2>
            <span className="text-sm text-gray-500">آخر التحديثات</span>
          </div>

          <div className="space-y-4">
            {[
              {
                action: "تم تسجيل الدخول للوحة التحكم",
                user: user.username,
                time: "الآن",
                icon: "🔐",
                type: "success",
              },
              {
                action: "تم تحديث إحصائيات النظام",
                user: "النظام",
                time: "قبل قليل",
                icon: "🔄",
                type: "info",
              },
              ...(stats.totalProducts > 0
                ? [
                    {
                      action: `تم تحميل ${stats.totalProducts} منتج`,
                      user: "النظام",
                      time: "قبل قليل",
                      icon: "📦",
                      type: "info",
                    },
                  ]
                : []),
              ...(stats.categoriesCount > 0
                ? [
                    {
                      action: `تم تحميل ${stats.categoriesCount} تصنيف`,
                      user: "النظام",
                      time: "قبل قليل",
                      icon: "📁",
                      type: "info",
                    },
                  ]
                : []),
              ...(stats.productsWithImages > 0
                ? [
                    {
                      action: `${stats.productsWithImages} منتج يحتوي على صور`,
                      user: "النظام",
                      time: "قبل قليل",
                      icon: "🖼️",
                      type: "success",
                    },
                  ]
                : []),
              ...(stats.productsWithoutImages > 0
                ? [
                    {
                      action: `${stats.productsWithoutImages} منتج يحتاج صور`,
                      user: "النظام",
                      time: "قبل قليل",
                      icon: "⚠️",
                      type: "warning",
                    },
                  ]
                : []),
            ].map((activity, index) => (
              <div
                key={index}
                className="flex items-center space-x-4 space-x-reverse p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activity.type === "success"
                      ? "bg-green-100"
                      : activity.type === "warning"
                      ? "bg-yellow-100"
                      : "bg-blue-100"
                  }`}
                >
                  <span className="text-lg">{activity.icon}</span>
                </div>
                <div className="flex-grow">
                  <p className="text-gray-900 font-medium">{activity.action}</p>
                  <p className="text-gray-500 text-sm">
                    {activity.user} • {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* تذييل الصفحة */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            آخر تحديث: {new Date().toLocaleString("ar-EG")}
          </p>
        </div>
      </div>
    </div>
  );
}