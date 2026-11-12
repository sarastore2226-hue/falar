"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import Link from "next/link";

interface RawOrderItem {
  product: string;
  quantity: number;
  price: number;
  color?: string | null;
  item_code?: string | null;
}

interface DisplayOrderItem extends RawOrderItem {
  image?: string;
}

interface OrderDetail {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  total_price: number;
  status: string;
  timestamp: string;
  items: DisplayOrderItem[];
}

interface ProductVariantResponse {
  color?: string;
  imageUrl?: string;
}

interface ProductSearchResponse {
  products?: Array<{
    variants?: ProductVariantResponse[];
  }>;
}

function OrderViewContent() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get("orderId");
  const token = searchParams.get("token");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setError("رقم الطلب غير صحيح");
      setLoading(false);
      return;
    }

    // 1. تسجيل الدخول التلقائي للعميل في المتجر عبر التوكن
    if (token) {
      try {
        const [base64Payload] = token.split(".");
        if (base64Payload) {
          const payload = JSON.parse(
            atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"))
          );
          if (payload && payload.phone) {
            localStorage.setItem(
              "customer",
              JSON.stringify({
                userid: payload.userId,
                usercode: payload.usercode,
                username: payload.username,
                phone: payload.phone,
                position: "عميل",
                permissions: "view_products",
              })
            );
            localStorage.setItem(
              "customerToken",
              `customer_${payload.userId}_pos`
            );
          }
        }
      } catch (err) {
        console.warn("Auto-login error:", err);
      }
    }

    // 2. جلب بيانات الأوردر وعناصره وصوره
    async function loadOrder() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error("تعذر العثور على الفاتورة");

        const data = await res.json();
        const rawItems = (data.items || []) as RawOrderItem[];

        const itemsWithImages: DisplayOrderItem[] = await Promise.all(
          rawItems.map(async (item) => {
            let img =
              "https://via.placeholder.com/300x400/f3f4f6/999999?text=RoyaKids";
            if (item.item_code) {
              try {
                const prodRes = await fetch(
                  `/api/products?search=${encodeURIComponent(item.item_code)}`
                );
                if (prodRes.ok) {
                  const prodData =
                    (await prodRes.json()) as ProductSearchResponse;
                  if (prodData.products && prodData.products.length > 0) {
                    const p = prodData.products[0];
                    const variant = p.variants?.find(
                      (v) => v.color === item.color
                    );
                    img = variant?.imageUrl || p.variants?.[0]?.imageUrl || img;
                  }
                }
              } catch {
                // استخدام الصورة الافتراضية
              }
            }
            return { ...item, image: img };
          })
        );

        setOrder({ ...data, items: itemsWithImages });
      } catch (err: unknown) {
        const errMessage =
          err instanceof Error
            ? err.message
            : "حدث خطأ أثناء تحميل الفاتورة";
        setError(errMessage);
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId, token]);

  if (loading) {
    return (
      <div
        className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="text-center space-y-3">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-bold text-gray-600 text-lg">
            جاري تجهيز مشترياتك بالصور...
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full space-y-4">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800">
            {error || "لم يتم العثور على الفاتورة"}
          </h2>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold"
          >
            الذهاب للمتجر الرئيسي
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      <Header />

      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* بطاقة الترحيب والملخص */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <span className="bg-white/20 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold inline-block mb-3">
              فاتورة مشتريات معتمدة ✅
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mb-2">
              أهلاً بك يا {order.customer_name} 👋
            </h1>
            <p className="text-blue-100 text-sm sm:text-base max-w-xl">
              سعداء بزيارتك لنا! إليك تفاصيل الأصناف والموديلات التي قمت باختيارها اليوم بصورها الحية.
            </p>
            <div className="mt-5 flex flex-wrap gap-4 text-xs sm:text-sm font-semibold">
              <span className="bg-black/30 px-3 py-1.5 rounded-xl">
                رقم الطلب: #{order.id}
              </span>
              <span className="bg-black/30 px-3 py-1.5 rounded-xl">
                التاريخ: {new Date(order.timestamp).toLocaleDateString("ar-EG")}
              </span>
              <span className="bg-emerald-500/80 px-3 py-1.5 rounded-xl text-white font-bold">
                الإجمالي: {Number(order.total_price).toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* شبكة كروت الأصناف بالصور */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-2">
              <span>👕</span>
              <span>الموديلات المشتراة ({order.items.length})</span>
            </h2>
            <span className="text-xs text-gray-500 font-bold">
              معاينة صور الموديلات والألوان
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {order.items.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group"
              >
                {/* صورة المنتج */}
                <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.product}
                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                  />
                  {item.color && (
                    <span className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold">
                      {item.color}
                    </span>
                  )}
                </div>

                {/* تفاصيل البند */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2">
                      {item.product}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono mt-1">
                      كود: {item.item_code}
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">
                        الكمية
                      </span>
                      <span className="text-base font-black text-blue-700">
                        {item.quantity} قطعة
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="text-xs text-gray-400 block font-medium">
                        سعر القطعة
                      </span>
                      <span className="text-base font-black text-gray-900">
                        {Number(item.price).toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* بطاقة الدعوة للتسوق الإلكتروني */}
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="text-4xl">🛍️</div>
          <h3 className="text-2xl font-black text-emerald-900">
            تريد طلب موديلات أخرى أونلاين؟
          </h3>
          <p className="text-emerald-700 text-sm sm:text-base max-w-lg mx-auto font-medium">
            حسابك مفعل الآن تلقائياً! تصفح تشكيلة الكتالوج الكاملة في المتجر، وأضف أي منتج للسلة وستصلك شحنتك فوراً.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 transition-all transform hover:scale-105"
            >
              <span>تصفح تشكيلة المتجر الآن ➔</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function OrderViewPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center font-bold">جاري تحميل الفاتورة...</div>
      }
    >
      <OrderViewContent />
    </Suspense>
  );
}