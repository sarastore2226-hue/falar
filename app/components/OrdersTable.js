"use client";

import { useState } from "react";
import PrintOrder from "./PrintOrder";
import { exportToExcel } from "../utils/exportToExcel";

export default function OrdersTable({
  orders,
  onPrint,
  onExport,
  onStatusChange,
  onCancelOrder,
  currentUser,
}) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [actionType, setActionType] = useState(""); // 'print' or 'export'

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "جاري":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "تم":
        return "bg-green-100 text-green-800 border-green-200";
      case "معلق":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "ملغي":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handlePrintClick = (order) => {
    setSelectedOrder(order);
    setActionType("print");
    setShowPrintModal(true);
  };

  const handleExportClick = (order) => {
    setSelectedOrder(order);
    setActionType("export");
    setShowPrintModal(true);
  };

  const confirmAction = () => {
    if (selectedOrder && actionType === "print") {
      onPrint(selectedOrder.id);
    } else if (selectedOrder && actionType === "export") {
      onExport(selectedOrder.id);
      // تصدير ملف Excel فعلي
      exportSingleOrder(selectedOrder);
    }
    setShowPrintModal(false);
    setSelectedOrder(null);
    setActionType("");
  };

  const handleBulkExport = () => {
    if (orders.length > 0) {
      exportToExcel(orders, "جميع_الطلبات");
      alert(`✅ تم تصدير ${orders.length} طلب إلى ملف Excel`);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* رأس الجدول مع خيار التصدير الجماعي */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            قائمة الطلبات ({orders.length})
          </h3>
          {orders.length > 0 && (
            <button
              onClick={handleBulkExport}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2"
            >
              📊 تصدير الكل Excel
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  رقم الطلب
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  العميل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الهاتف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المبلغ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ الطلب
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {order.id}
                    </div>
                    {order.printed_by && (
                      <div className="text-xs text-purple-600 mt-1">
                        🖨️ {order.printed_by}
                      </div>
                    )}
                    {order.exported_by && (
                      <div className="text-xs text-blue-600 mt-1">
                        📊 {order.exported_by}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {order.customer_name}
                    </div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {order.address}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                    {formatCurrency(order.total_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* ✅ التغيير هنا: عرض القيمة الحقيقية بدلاً من select */}
                    <span
                      className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(order.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors text-xs flex items-center gap-1"
                      >
                        👁️ عرض التفاصيل
                      </button>
                      {order.status === "جاري" && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء."
                              )
                            ) {
                              onCancelOrder(order.id);
                            }
                          }}
                          className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition-colors text-xs flex items-center gap-1"
                        >
                          ❌ إلغاء الطلب
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">📦</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              لا توجد طلبات
            </h3>
            <p className="text-gray-600">
              لم يتم العثور على طلبات تطابق معايير البحث
            </p>
          </div>
        )}
      </div>

      {/* نافذة تأكيد الإجراء */}
      {showPrintModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {actionType === "print" ? "تأكيد الطباعة" : "تأكيد التصدير"}
              </h3>
              <p className="text-gray-600 mb-2">
                {actionType === "print"
                  ? `هل تريد طباعة الطلب ${selectedOrder.id}؟`
                  : `هل تريد تصدير الطلب ${selectedOrder.id} إلى Excel？`}
              </p>
              {actionType === "print" && (
                <p className="text-sm text-gray-500 mb-4">
                  بعد الطباعة، سيتم تغيير حالة الطلب إلى "تم" وتسجيل اسمك كموظف
                  قام بالطباعة.
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowPrintModal(false);
                    setSelectedOrder(null);
                    setActionType("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmAction}
                  className={`px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors ${
                    actionType === "print" ? "bg-blue-600" : "bg-green-600"
                  }`}
                >
                  {actionType === "print" ? "تأكيد الطباعة" : "تأكيد التصدير"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة عرض التفاصيل */}
      {selectedOrder && !showPrintModal && (
        <PrintOrder
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onPrint={() => {
            onPrint(selectedOrder.id);
            setSelectedOrder(null);
          }}
          onExport={() => {
            onExport(selectedOrder.id);
            exportToExcel([selectedOrder], `طلب_${selectedOrder.id}`);
            setSelectedOrder(null);
          }}
        />
      )}
    </>
  );
}
