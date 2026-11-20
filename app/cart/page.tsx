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

  const [paymentMethod, setPaymentMethod] = useState<"paymob" | "cod">("paymob");

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
          quantity: item.quantity || 1, // الحساب بالقطع
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
  const total = subtotal;

  useEffect(() => {
    const loadCustomerData = () => {
      try {
        const customer = localStorage.getItem("customer");
        const savedAddress = localStorage.getItem("customer_address");

        if (customer) {
          const parsedData = JSON.parse(customer);
         setCustomerData({
            name: parsedData.username || "",
            phone: parsedData.phone || "",
            address: savedAddress || parsedData.address || "",
          });
        }
      } catch (error) {
        console.error("Error loading customer data:", error);
      }
    };

    loadCustomerData();
  }, []);

  const handleSubmitOrder = async () => {
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
        payment_method: paymentMethod,
        items: cartItems.map((item) => ({
          product: `${item.name} (${item.seriesQuantity} سرية)`,
          quantity: item.quantity, // عدد القطع التام = سريات * 4
          price: item.price,
          color: item.color,
          size: "ONE SIZE",
          category: item.category,
          item_code: item.item_code || item.master_code,
          master_code: item.master_code,
        })),
        total_price: total,
      };

      const response = await fetch("/api/saveOrder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (result.success) {
        localStorage.setItem("customer_address", customerData.address);
        clearCart();

        if (result.paymentUrl) {
          window.location.href = result.paymentUrl;
          return;
        }

        setOrderSuccess(true);
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

  const handleRemoveItem = (itemId: string) => {
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
              تم إرسال طلب الجملة بنجاح!
            </h2>
            <p className="text-gray-600 mb-8 text-lg">
              شكراً لتسوقك معنا. تم تسجيل الفاتورة وجاري تجهيز الشحنة.
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
              لم تقم بإضافة أي موديلات إلى سلة التسوق بعد
            </p>
            <Link
              href="/"
              className="btn-primary inline-flex items-center space-x-2 space-x-reverse"
            >
              <span>استمر في التسوق</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50" dir="rtl">
      <Header />

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">سلة مشتريات الجملة</h1>
          <p className="text-gray-600 text-lg">راجع مشترياتك وسرياتك وأكمل الطلب</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  الموديلات المختارة ({cartItems.length})
                </h2>
                <span className="text-gray-600 text-sm font-bold">
                  إجمالي السريات:{" "}
                  {cartItems.reduce(
                    (totalCount, item) => totalCount + (item.seriesQuantity || 1),
                    0
                  )}{" "}
                  سرية
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
                    <div className="flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-24 h-24 object-contain rounded-lg shadow-md bg-white p-1"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://via.placeholder.com/96x96/EFEFEF/666666?text=No+Image";
                        }}
                      />
                    </div>

                    <div className="flex-grow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {item.name}
                        </h3>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          aria-label="حذف العنصر"
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

                      <div className="flex flex-wrap gap-2 mb-3">
                        {item.master_code && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-mono">
                            كود الموديل: {item.master_code}
                          </span>
                        )}
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-bold">
                          اللون: {item.color || "افتراضي"}
                        </span>
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md font-bold">
                          {item.seriesQuantity} سرية = {item.quantity} قطعة
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, (item.seriesQuantity || 1) - 1)
                            }
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                            disabled={(item.seriesQuantity || 1) <= 1}
                            aria-label="تقليل السريات"
                          >
                            -
                          </button>

                          <span className="w-16 text-center font-bold text-gray-900">
                            {item.seriesQuantity || 1} سرية
                          </span>

                          <button
                            onClick={() =>
                              updateQuantity(item.id, (item.seriesQuantity || 1) + 1)
                            }
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="زيادة السريات"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-bold text-blue-600">
                            {(
                              (item.price || 0) * (item.quantity || 1)
                            ).toLocaleString()}{" "}
                            ج.م
                          </div>
                          <div className="text-xs text-gray-500">
                            {(item.price || 0).toLocaleString()} ج.م للقطعة (السرية: {((item.price || 0) * 4).toLocaleString()} ج.م)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* بيانات مستلم الطلب وطريقة الدفع */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                بيانات مستلم الطلب
              </h2>

              {orderError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm font-bold">
                  {orderError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اسم التاجر / المحل *
                  </label>
                  <input
                    type="text"
                    value={customerData.name}
                    onChange={(e) =>
                      setCustomerData({ ...customerData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    placeholder="أدخل اسمك أو اسم المحل"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    placeholder="01XXXXXXXXX"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العنوان بالتفصيل *
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    placeholder="المدينة - المنطقة - تفاصيل العنوان لتسليم الشحنة"
                  />
                </div>
              </div>

              {/* اختيار وسيلة الدفع (Paymob أو عند الاستلام) */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  طريقة الدفع
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label
                    onClick={() => setPaymentMethod("paymob")}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      paymentMethod === "paymob"
                        ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === "paymob"}
                        onChange={() => setPaymentMethod("paymob")}
                        className="w-5 h-5 text-emerald-600"
                      />
                      <div>
                        <p className="font-bold text-gray-900 text-sm sm:text-base">
                          دفع إلكتروني آمن
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          فيزا / ماستركارد / ميزة / محافظ إلكترونية
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl">💳</span>
                  </label>

                  <label
                    onClick={() => setPaymentMethod("cod")}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      paymentMethod === "cod"
                        ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === "cod"}
                        onChange={() => setPaymentMethod("cod")}
                        className="w-5 h-5 text-emerald-600"
                      />
                      <div>
                        <p className="font-bold text-gray-900 text-sm sm:text-base">
                          الدفع عند الاستلام
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          سداد نقدي عند استلام الشحنة
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl">💵</span>
                  </label>
                </div>
              </div>

              {/* زر التأكيد */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border-2 border-emerald-700 bg-emerald-600 px-4 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 disabled:bg-gray-400"
                >
                  {isSubmitting
                    ? "جاري المعالجة..."
                    : paymentMethod === "paymob"
                    ? `الانتقال للدفع الآمن (${total.toLocaleString()} ج.م)`
                    : `تأكيد طلب الجملة (${total.toLocaleString()} ج.م)`}
                </button>
              </div>
            </div>
          </div>

          {/* ملخص الطلب */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 border-b pb-3">
                ملخص الفاتورة
              </h2>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">المجموع الفرعي:</span>
                <span className="font-bold text-gray-900">
                  {(subtotal || 0).toLocaleString()} ج.م
                </span>
              </div>

              {promotionDiscount > 0 && (
                <div className="flex justify-between items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  <span className="font-bold">خصم العرض:</span>
                  <span className="font-extrabold">
                    -{promotionDiscount.toLocaleString()} ج.م
                  </span>
                </div>
              )}

              <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">المجموع النهائي:</span>
                <span className="text-2xl font-black text-blue-600">
                  {(total || 0).toLocaleString()} ج.م
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}