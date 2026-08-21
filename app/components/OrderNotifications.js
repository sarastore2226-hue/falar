"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";

function playChime() {
  try {
    const AudioContextCtor =
      window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;

    const playNote = (freq, start, duration, type = "sine") => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    playNote(880, now, 0.5, "sine");
    playNote(1320, now + 0.18, 0.5, "sine");
  } catch (error) {
    /* audio not supported */
  }
}

export default function OrderNotifications() {
  const { connected, pendingCount, pendingOrders } = useOrderRealtime({
    enabled: true,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const handleNewOrder = (event) => {
      const order = event.detail;
      setToast(order);
      setShowToast(true);
      playChime();

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setShowToast(false);
      }, 6000);
    };

    window.addEventListener("order-created", handleNewOrder);
    return () => {
      window.removeEventListener("order-created", handleNewOrder);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleClick = () => {
    setIsOpen((prev) => !prev);
  };

  const formatTime = useCallback((value) => {
    try {
      return new Date(value).toLocaleString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "";
    }
  }, []);

  const formatPrice = useCallback((value) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
    }).format(Number(value) || 0);
  }, []);

  return (
    <>
      {/* Toast إشعار طلب جديد */}
      <div
        className={`fixed bottom-6 left-6 z-[100] transform transition-all duration-500 ${
          showToast && toast
            ? "translate-y-0 opacity-100"
            : "translate-y-24 opacity-0 pointer-events-none"
        }`}
      >
        {toast && (
          <div className="bg-white rounded-2xl shadow-2xl border border-green-200 p-4 w-80 max-w-[calc(100vw-3rem)]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
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
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  تم وصول طلب جديد!
                </p>
                <p className="text-sm text-gray-700 mt-0.5">
                  {toast.customer_name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {toast.id} - {formatPrice(toast.total_price)}
                </p>
              </div>
              <button
                onClick={() => setShowToast(false)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                aria-label="إغلاق الإشعار"
              >
                <svg
                  className="w-4 h-4"
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
            <Link
              href="/dashboard/orders"
              onClick={() => setShowToast(false)}
              className="mt-3 block w-full text-center bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              عرض الطلب
            </Link>
          </div>
        )}
      </div>

      {/* زر الجرس */}
      <div className="relative">
        <button
          onClick={handleClick}
          className="p-2 text-gray-600 hover:text-pink-600 transition-colors hover:bg-pink-50 rounded-lg relative"
          title={
            connected
              ? "إشعارات الطلبات المباشرة"
              : "جاري الاتصال بخادم الإشعارات..."
          }
          aria-label="إشعارات الطلبات"
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
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {/* مؤشر الاتصال */}
          {connected && (
            <span className="absolute bottom-1 left-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></span>
          )}

          {/* عداد الطلبات تحت التجهيز (لا يوجد رد فعل بعد) */}
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold border border-white shadow-sm">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </button>

        {/* القائمة المنسدلة */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">إشعارات الطلبات</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  {connected ? "متصل مباشرة" : "غير متصل"}
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {pendingOrders.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg
                        className="w-6 h-6 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">
                      لا توجد طلبات بانتظار التنفيذ
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      كل الطلبات تم التعامل معها
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pendingOrders.slice(0, 20).map((order) => (
                      <Link
                        key={order.id}
                        href="/dashboard/orders"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-4 h-4 text-orange-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {order.customer_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {order.id} - {formatTime(order.timestamp)}
                          </p>
                          <span className="inline-block mt-1 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                            بانتظار التنفيذ
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-green-600 flex-shrink-0">
                          {formatPrice(order.total_price)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-gray-100">
                <Link
                  href="/dashboard/orders"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  الذهاب لإدارة الطلبات
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
