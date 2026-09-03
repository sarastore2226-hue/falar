"use client";

import Header from "../components/Header";
import Link from "next/link";
import { useCart } from "../../context/CartContext";
import { useState, useEffect } from "react";

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart, getCartTotal, clearCart } =
    useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [pricedItems, setPricedItems] = useState(cartItems);
  const [promotionTotal, setPromotionTotal] = useState<number | null>(null);
  const [appliedPromotions, setAppliedPromotions] = useState<
    Array<{ name: string; category: string; quantity: number; savings: number }>
  >([]);

  // بيانات العميل - سيتم ملؤها تلقائياً
  const [customerData, setCustomerData] = useState({
    name: "",
    address: "",
    phone: "",
  });

  useEffect(() => {
    let cancelled = false;
    if (cartItems.length === 0) {
      setPricedItems([]);
      setPromotionTotal(0);
      setAppliedPromotions([]);
      return () => { cancelled = true; };
    }
    fetch("/api/promotions/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cartItems.map((item) => ({
          product: item.name,
          category: item.category,
          quantity: item.quantity || 1,
          price: item.price || 0,
        })),
      }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled && result.success) {
          setPricedItems(
            cartItems.map((item, index) => ({
              ...item,
              price: result.items[index]?.finalUnitPrice ?? item.price,
            }))
          );
          setPromotionTotal(result.total);
          setAppliedPromotions(result.appliedPromotions || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPromotionTotal(null);
          setAppliedPromotions([]);
        }
      });
    return () => { cancelled = true; };
  }, [cartItems]);

  const subtotal = promotionTotal ?? getCartTotal();
  const promotionDiscount = Math.max(0, getCartTotal() - subtotal);
  // ✅ إلغاء الشحن والضريبة
  const shipping = 0; // مجاني دائماً
  const tax = 0; // إلغاء الضريبة
  const total = subtotal; // ✅ المجموع الكلي = المجموع الفرعي فقط

  // ✅ جديد: جلب بيانات العميل من localStorage تلقائياً
  useEffect(() => {
    const loadCustomerData = () => {
      try {
        const customer = localStorage.getItem("customer");
        const savedAddress = localStorage.getItem("customer_address");

        if (customer) {
          const customerData = JSON.parse(customer);
          console.log("👤 بيانات العميل المحملة:", customerData);

          setCustomerData({
            name: customerData.username || "",
            phone: customerData.phone || "",
            address: savedAddress || "", // تحميل العنوان المحفوظ
          });
        }
      } catch (error) {
        console.error("Error loading customer data:", error);
      }
    };

    loadCustomerData();
  }, []);

  // ✅ دالة إرسال الطلب - محدثة
  const handleSubmitOrder = async () => {
    // التحقق من اكتمال البيانات
    if (!customerData.name || !customerData.address || !customerData.phone) {
      setOrderError("يرجى ملء جميع بيانات العميل");
      return;
    }

    setIsSubmitting(true);
    setOrderError("");

    try {
      const orderData = {
        customer_name: customerData.name,
        address: customerData.address,
        phone: customerData.phone,
        items: cartItems.map((item) => ({
          product: item.name,
          quantity: item.quantity || 1,
          price: item.price || 0,
          color: item.color,
          size: item.size,
          category: item.category,
          item_code: item.item_code || item.master_code,
          master_code: item.master_code,
        })),
        total_price: total,
      };

      console.log("📦 بيانات الطلب المرسلة:", orderData);

      const response = await fetch("/api/saveOrder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (result.success) {
        // ✅ حفظ العنوان للطلبات القادمة
        localStorage.setItem("customer_address", customerData.address);

        setOrderSuccess(true);
        clearCart();
      } else {
        setOrderError(result.error || "فشل في إرسال الطلب");
      }
    } catch (error) {
      console.error("Error submitting order:", error);
      setOrderError("حدث خطأ أثناء إرسال الطلب");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ دالة إزالة المنتج - محدثة
  const handleRemoveItem = (itemId: string) => {
    console.log("🗑️ إزالة المنتج بالـ ID:", itemId);
    removeFromCart(itemId);
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Header />
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg
                className="w-16 h-16 text-green-600"
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              تم إرسال طلبك بنجاح!
            </h2>
            <p className="text-gray-600 mb-8 text-lg">
              شكراً لتسوقك معنا. سنتواصل معك قريباً لتأكيد الطلب.
            </p>
            <Link
              href="/"
              className="btn-primary inline-flex items-center space-x-2 space-x-reverse"
            >
              <span>العودة للرئيسية</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0 && !orderSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Header />
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <div className="w-32 h-32 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg
                className="w-16 h-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5.5M7 13l2.5 5.5m5.5-5.5h5"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              سلة التسوق فارغة
            </h2>
            <p className="text-gray-600 mb-8 text-lg">
              لم تقم بإضافة أي منتجات إلى سلة التسوق بعد
            </p>
            <Link
              href="/"
              className="btn-primary inline-flex items-center space-x-2 space-x-reverse"
            >
              <span>استمر في التسوق</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Header />

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* رأس الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">سلة التسوق</h1>
          <p className="text-gray-600 text-lg">راجع مشترياتك وأكمل الطلب</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* قائمة المنتجات */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  المنتجات ({cartItems.length})
                </h2>
                <span className="text-gray-600 text-sm">
                  إجمالي العناصر:{" "}
                  {cartItems.reduce(
                    (total, item) => total + (item.quantity || 1),
                    0
                  )}
                </span>
              </div>

              {appliedPromotions.length > 0 && (
                <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-800">
                  <p className="text-lg font-extrabold">تم تطبيق العرض على طلبك</p>
                  {appliedPromotions.map((promotion) => (
                    <p key={`${promotion.name}-${promotion.category}`} className="mt-1 text-sm">
                      {promotion.name}: {promotion.quantity} قطع، قيمة الخصم {promotion.savings.toLocaleString()} ج.م
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-6">
                {pricedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 transition-all duration-300"
                  >
                    {/* صورة المنتج */}
                    <div className="flex-shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-24 h-24 object-cover rounded-lg shadow-md"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://via.placeholder.com/96x96/EFEFEF/666666?text=No+Image";
                        }}
                      />
                    </div>

                    {/* معلومات المنتج */}
                    <div className="flex-grow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {item.name}
                        </h3>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* كود الصنف و master_code - محدث */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {item.master_code && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-mono">
                            الكود: {item.master_code}
                          </span>
                        )}
                        {item.item_code && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-md font-mono">
                            كود المنتج: {item.item_code}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 mb-3">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="text-gray-600 text-sm">اللون:</span>
                          <span className="font-medium text-gray-900">
                            {item.color || "افتراضي"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="text-gray-600 text-sm">المقاس:</span>
                          <span className="font-medium text-gray-900">
                            {item.size || "ONE SIZE"}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        {/* تعديل الكمية - محدث */}
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, (item.quantity || 1) - 1)
                            }
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={(item.quantity || 1) <= 1}
                          >
                            <svg
                              className="w-4 h-4 text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 12H4"
                              />
                            </svg>
                          </button>

                          <span className="w-12 text-center font-medium text-gray-900">
                            {item.quantity || 1}
                          </span>

                          <button
                            onClick={() =>
                              updateQuantity(item.id, (item.quantity || 1) + 1)
                            }
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={
                              (item.quantity || 1) >= (item.maxQuantity || 999)
                            }
                          >
                            <svg
                              className="w-4 h-4 text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </button>
                        </div>

                        {/* السعر */}
                        <div className="text-right">
                          <div className="text-xl font-bold text-gradient">
                            {(
                              (item.price || 0) * (item.quantity || 1)
                            ).toLocaleString()}{" "}
                            ج.م
                          </div>
                          {(item.quantity || 1) > 1 && (
                            <div className="text-sm text-gray-500">
                              {(item.price || 0).toLocaleString()} ج.م للقطعة
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* استمرار التسوق */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <Link
                  href="/"
                  className="inline-flex items-center space-x-2 space-x-reverse text-blue-600 hover:text-blue-700 font-medium"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  <span>استمر في التسوق</span>
                </Link>
              </div>
            </div>

            {/* نموذج بيانات العميل */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                بيانات العميل
              </h2>

              {/* ✅ جديد: رسالة توضيحية */}
              {customerData.name && (
                <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-blue-700 text-sm">
                      تم تحميل بياناتك تلقائياً. يرجى التأكد من العنوان فقط.
                    </span>
                  </div>
                </div>
              )}

              {orderError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <svg
                      className="w-5 h-5 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-red-700">{orderError}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الاسم الكامل *
                  </label>
                  <input
                    type="text"
                    value={customerData.name}
                    onChange={(e) =>
                      setCustomerData({ ...customerData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="أدخل اسمك الكامل"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رقم الهاتف *
                  </label>
                  <input
                    type="tel"
                    value={customerData.phone}
                    onChange={(e) =>
                      setCustomerData({
                        ...customerData,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="05XXXXXXXX"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العنوان *
                  </label>
                  <textarea
                    value={customerData.address}
                    onChange={(e) =>
                      setCustomerData({
                        ...customerData,
                        address: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="أدخل عنوانك بالتفصيل"
                  />
                </div>
              </div>

              {/* ✅ نقل زر إتمام الشراء هنا تحت بيانات العميل */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border-2 border-emerald-700 bg-emerald-600 px-4 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:border-gray-400 disabled:bg-gray-400 disabled:shadow-none"
                >
                  {isSubmitting ? "جاري إرسال الطلب..." : "إتمام الشراء"}
                </button>
                
                {/* ✅ ضمانات إضافية */}
                <div className="mt-6 space-y-3 text-sm text-gray-600">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <svg
                      className="w-5 h-5 text-green-500"
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
                    <span>شحن مجاني للطلبات فوق 2000 ج.م</span>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4-4L19 7"
                      />
                    </svg>
                    <span>إرجاع مجاني خلال 14 يوم</span>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <svg
                      className="w-5 h-5 text-green-500"
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
                    <span>ضمان 30 يوم على جميع المنتجات</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ملخص الطلب */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                ملخص الطلب
              </h2>

              {/* تفاصيل الأسعار */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">المجموع الفرعي</span>
                  <span className="font-medium text-gray-900">
                    {(subtotal || 0).toLocaleString()} ج.م
                  </span>
                </div>

                {promotionDiscount > 0 && (
                  <div className="flex justify-between items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                    <span className="font-bold">قيمة خصم العرض</span>
                    <span className="font-extrabold">
                      -{promotionDiscount.toLocaleString()} ج.م
                    </span>
                  </div>
                )}

                {/* ✅ إزالة سطور الشحن والضريبة */}

                {/* ✅ رسالة الشحن المجاني */}
                {subtotal < 2000 ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-blue-700 text-sm">
                        أنفق {(2000 - subtotal).toLocaleString()} ج.م أخرى واحصل على شحن مجاني!
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <svg
                        className="w-5 h-5 text-green-600"
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
                      <span className="text-green-700 text-sm">
                        ✓ مبلغ الطلب مؤهل للشحن المجاني
                      </span>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">
                      المجموع الكلي
                    </span>
                    <span className="text-2xl font-bold text-gradient">
                      {(total || 0).toLocaleString()} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* ✅ إزالة زر إتمام الشراء من هنا */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}