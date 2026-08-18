"use client";

import { useRef } from "react";

export default function PrintOrder({ order, onClose, onPrint, onExport }) {
  const contentRef = useRef();

  const handlePrint = () => {
    const printContent = contentRef.current;
    if (!printContent) {
      alert("لا يوجد محتوى للطباعة");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة للطباعة");
      return;
    }

    // ✅ إزالة عمودي اللون والمقاس
    const productsTableHTML = `
      <table class="products-table">
        <thead>
          <tr>
            <th>كود المنتج</th>
            <th>اسم المنتج</th>
            <th>الكمية</th>
            <th>سعر الوحدة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${order.items
            ?.map(
              (item, index) => `
            <tr>
              <td class="product-code">${item.item_code || "غير محدد"}</td>
              <td class="product-name">${
                item.product
              }</td> <!-- ✅ يحتوي على اللون والمقاس -->
              <td>${item.quantity}</td>
              <td class="price">${formatCurrency(item.price)}</td>
              <td class="price">${formatCurrency(
                item.quantity * item.price
              )}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="4">الإجمالي النهائي</td>
            <td>${formatCurrency(order.total_price)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة طلب - ${order.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Tajawal', sans-serif;
            background: white;
            color: #1f2937;
            line-height: 1.6;
            padding: 0;
          }
          
          .invoice-container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: white;
            padding: 20mm;
          }
          
          /* الهيدر */
          .invoice-header {
            text-align: center;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .invoice-header h1 {
            font-size: 28px;
            font-weight: 800;
            color: #1f2937;
            margin-bottom: 10px;
          }
          
          .order-info {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #6b7280;
            margin-top: 10px;
          }
          
          /* معلومات العميل والطلب */
          .info-sections {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          
          .info-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
          }
          
          .info-card h3 {
            color: #3b82f6;
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .info-item {
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
          }
          
          .info-item strong {
            color: #4b5563;
            min-width: 100px;
          }
          
          .status-badge {
            background: #f59e0b;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          }
          
          .status-completed {
            background: #10b981;
          }
          
          .price {
            color: #059669;
            font-weight: 600;
          }
          
          /* جدول المنتجات */
          .products-section {
            margin-bottom: 25px;
          }
          
          .products-section h3 {
            color: #3b82f6;
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
            text-align: center;
          }
          
          .products-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          
          .products-table thead {
            background: #3b82f6;
            color: white;
          }
          
          .products-table th {
            padding: 10px 8px;
            text-align: center;
            font-weight: 600;
            border: 1px solid #2563eb;
          }
          
          .products-table td {
            padding: 8px 6px;
            text-align: center;
            border: 1px solid #d1d5db;
          }
          
          .products-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          
          .product-code {
            font-family: 'Courier New', monospace;
            font-weight: 600;
            color: #3b82f6;
            font-size: 11px;
          }
          
          .product-name {
            font-weight: 500;
            text-align: right;
            padding: 8px 10px;
          }
          
          .total-row {
            background: #1f2937 !important;
            color: white;
            font-weight: 700;
          }
          
          .total-row td {
            border: 1px solid #374151;
            padding: 10px;
          }
          
          /* الملاحظات */
          .notes-section {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
          }
          
          .notes-section h4 {
            color: #92400e;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          
          .notes-list {
            list-style: none;
            color: #92400e;
            font-size: 12px;
          }
          
          .notes-list li {
            margin-bottom: 4px;
            padding-right: 12px;
            position: relative;
          }
          
          .notes-list li:before {
            content: "•";
            color: #f59e0b;
            font-weight: bold;
            position: absolute;
            right: 0;
          }
          
          /* التذييل */
          .invoice-footer {
            text-align: center;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
            color: #6b7280;
            font-size: 11px;
          }
          
          .company-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          
          .thank-you {
            color: #3b82f6;
            font-weight: 600;
            margin-top: 5px;
          }
          
          /* أنماط الطباعة */
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            
            .invoice-container {
              box-shadow: none;
              padding: 15mm;
              margin: 0;
            }
            
            .no-print {
              display: none !important;
            }
          }
          
          @page {
            size: A4;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- الهيدر -->
          <div class="invoice-header">
            <h1>فاتورة طلب</h1>
            <div class="order-info">
              <div><strong>رقم الطلب:</strong> ${order.id}</div>
              <div><strong>التاريخ:</strong> ${formatDate(
                order.timestamp
              )}</div>
            </div>
          </div>

          <!-- معلومات العميل والطلب -->
          <div class="info-sections">
            <div class="info-card">
              <h3>معلومات العميل</h3>
              <div class="info-item">
                <strong>الاسم:</strong>
                <span>${order.customer_name}</span>
              </div>
              <div class="info-item">
                <strong>الهاتف:</strong>
                <span>${order.phone}</span>
              </div>
              <div class="info-item">
                <strong>العنوان:</strong>
                <span>${order.address}</span>
              </div>
            </div>

            <div class="info-card">
              <h3>معلومات الطلب</h3>
              <div class="info-item">
                <strong>الحالة:</strong>
                <span class="status-badge ${
                  order.status === "تم" ? "status-completed" : ""
                }">
                  ${order.status}
                </span>
              </div>
              <div class="info-item">
                <strong>المبلغ الإجمالي:</strong>
                <span class="price">${formatCurrency(order.total_price)}</span>
              </div>
              ${
                order.printed_by
                  ? `
              <div class="info-item">
                <strong>تم الطباعة بواسطة:</strong>
                <span>${order.printed_by}</span>
              </div>
              `
                  : ""
              }
              ${
                order.printed_at
                  ? `
              <div class="info-item">
                <strong>تاريخ الطباعة:</strong>
                <span>${formatDate(order.printed_at)}</span>
              </div>
              `
                  : ""
              }
            </div>
          </div>

          <!-- جدول المنتجات -->
          <div class="products-section">
            <h3>المنتجات المطلوبة</h3>
            ${productsTableHTML}
          </div>

          <!-- الملاحظات -->
          <div class="notes-section">
            <h4>ملاحظات هامة</h4>
            <ul class="notes-list">
              <li>يرجى الاحتفاظ بهذه الفاتورة كإثبات للشراء</li>
              <li>للاستفسارات، يرجى الاتصال على رقم خدمة العملاء</li>
              <li>شكراً لثقتكم بمتجر أحلام للأطفال</li>
            </ul>
          </div>

          <!-- التذييل -->
          <div class="invoice-footer">
            <div class="company-info">
              <div>متجر أحلام للأطفال</div>
              <div>${new Date().getFullYear()} © جميع الحقوق محفوظة</div>
            </div>
            <div class="thank-you">شكراً لاختياركم متجرنا</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => {
              window.close();
            }, 1000);
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();

    if (onPrint) {
      onPrint();
    }
  };

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

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              تفاصيل الطلب - {order.id}
            </h2>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                🖨️ طباعة و شحن
              </button>
              <button
                onClick={onExport}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                📊 تصدير Excel
              </button>
              <button
                onClick={onClose}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div ref={contentRef} style={{ display: "none" }}>
              {/* هذا المحتوى مخفي ويستخدم فقط للطباعة */}
            </div>

            {/* عرض معاينة للفاتورة */}
            <div className="bg-white p-6 border border-gray-200 rounded-lg">
              <div className="text-center mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  فاتورة طلب - {order.id}
                </h1>
                <p className="text-gray-600 mt-2">معاينة قبل الطباعة</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-600 mb-3">
                    معلومات العميل
                  </h3>
                  <p>
                    <strong>الاسم:</strong> {order.customer_name}
                  </p>
                  <p>
                    <strong>الهاتف:</strong> {order.phone}
                  </p>
                  <p>
                    <strong>العنوان:</strong> {order.address}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-600 mb-3">
                    معلومات الطلب
                  </h3>
                  <p>
                    <strong>الحالة:</strong>
                    <span
                      className={`mr-2 px-2 py-1 rounded-full text-sm ${
                        order.status === "جاري"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {order.status}
                    </span>
                  </p>
                  <p>
                    <strong>المبلغ الإجمالي:</strong>{" "}
                    {formatCurrency(order.total_price)}
                  </p>
                  {order.printed_by && (
                    <p>
                      <strong>تم الطباعة بواسطة:</strong> {order.printed_by}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-blue-600 mb-4 text-center">
                  المنتجات المطلوبة
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        <th className="border border-blue-700 px-3 py-2">
                          كود المنتج
                        </th>
                        <th className="border border-blue-700 px-3 py-2">
                          اسم المنتج
                        </th>
                        <th className="border border-blue-700 px-3 py-2">
                          الكمية
                        </th>
                        <th className="border border-blue-700 px-3 py-2">
                          سعر الوحدة
                        </th>
                        <th className="border border-blue-700 px-3 py-2">
                          الإجمالي
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items?.map((item, index) => (
                        <tr
                          key={index}
                          className={
                            index % 2 === 0 ? "bg-gray-50" : "bg-white"
                          }
                        >
                          <td className="border border-gray-300 px-2 py-1 text-center font-mono text-xs">
                            {item.item_code || "غير محدد"}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {item.product} {/* ✅ يحتوي على اللون والمقاس */}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center">
                            {item.quantity}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center font-semibold text-green-600">
                            {formatCurrency(item.quantity * item.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-800 text-white font-bold">
                        <td
                          colSpan="4"
                          className="border border-gray-700 px-4 py-2 text-left"
                        >
                          الإجمالي النهائي
                        </td>
                        <td className="border border-gray-700 px-4 py-2 text-center">
                          {formatCurrency(order.total_price)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
