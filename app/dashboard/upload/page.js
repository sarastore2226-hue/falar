"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Header from "../../components/Header";

// ==========================================
// Helper Components
// ==========================================

// 1. Toast Notification Component
const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium cursor-pointer transition-all transform hover:scale-105 flex items-center gap-2 min-w-[300px] animate-slideIn ${
            toast.type === "success"
              ? "bg-green-600"
              : toast.type === "error"
              ? "bg-red-600"
              : "bg-blue-600"
          }`}
        >
          <span>
            {toast.type === "success"
              ? "✅"
              : toast.type === "error"
              ? "❌"
              : "ℹ️"}
          </span>
          {toast.message}
        </div>
      ))}
    </div>
  );
};

// ==========================================
// Main Page Component
// ==========================================
export default function UploadDashboard() {
  // --- State: UI & Tabs ---
  const [activeTab, setActiveTab] = useState("upload");
  const [toasts, setToasts] = useState([]);

  // --- State: Upload Tab ---
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [isGlobalUploading, setIsGlobalUploading] = useState(false);

  // --- State: Manage Tab ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [items, setItems] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });

  // --- State: Cleanup ---
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupReport, setCleanupReport] = useState(null);

  // ==========================================
  // Helper Functions
  // ==========================================
  const addToast = (message, type = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // ==========================================
  // Tab 1 Logic: Upload & Drag-n-Drop
  // ==========================================
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const processFiles = (fileList) => {
    const newFiles = Array.from(fileList).map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: "pending",
      productCode: file.name.substring(0, file.name.lastIndexOf(".")),
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadAllFiles = async () => {
    const pendingFiles = files.filter(
      (f) => f.status === "pending" || f.status === "error"
    );
    if (pendingFiles.length === 0) {
      addToast("لا توجد ملفات جديدة للرفع", "info");
      return;
    }

    setIsGlobalUploading(true);

    for (const fileObj of pendingFiles) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id ? { ...f, status: "uploading", progress: 10 } : f
        )
      );

      const formData = new FormData();
      formData.append("file", fileObj.file);

      try {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileObj.id ? { ...f, progress: 50 } : f))
        );

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (data.success) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileObj.id
                ? {
                    ...f,
                    status: "success",
                    progress: 100,
                    message: data.message || "تم الرفع",
                  }
                : f
            )
          );
          
          // تحديث المعرض بعد رفع الصورة مباشرة
          if (activeTab === "manage") {
            setTimeout(() => fetchProducts(true), 1000);
          }
        } else {
          throw new Error(data.error || "فشل الرفع");
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, status: "error", progress: 0, message: error.message }
              : f
          )
        );
      }
    }

    setIsGlobalUploading(false);
    addToast("اكتملت عملية المعالجة", "info");
  };

  // ==========================================
  // Tab 2 Logic: Manage & Gallery
  // ==========================================

  const fetchProducts = useCallback(
    async (resetPage = false) => {
      setLoadingProducts(true);
      try {
        const page = resetPage ? 1 : pagination.page;
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString(),
          search: searchTerm,
          employee: "true",
        });

        const res = await fetch(`/api/products?${queryParams.toString()}`);
        const data = await res.json();

        if (data.success && data.products) {
          console.log("📦 البيانات القادمة من الـ API:", data.products[0]);

          const colorItems = [];

          // تجميع حسب اللون
          data.products.forEach((group) => {
            if (group.variants && group.variants.length > 0) {
              // إنشاء خريطة لتجميع الفاريانتات حسب اللون
              const colorMap = new Map();
              
              group.variants.forEach((variant) => {
                const color = variant.color || "افتراضي";
                
                if (!colorMap.has(color)) {
                  // هذا أول مقاس لهذا اللون - ننشئ عنصر جديد للون
                  // ✅ استخدام item_code الخاص باللون (من قاعدة البيانات)
                  const itemCode = variant.item_code || "";
                  
                  colorMap.set(color, {
                    uniqueKey: `${group.master_code}-${color}`,
                    master_code: String(group.master_code || "N/A"),
                    // ✅ هذا هو المفتاح: استخدام item_code الخاص باللون
                    item_code: itemCode,
                    // ✅ اسم ملف الصورة (الذي يجب أن يطابق item_code)
                    imageFileName: variant.imageFileName || itemCode,
                    description: group.description || group.item_name,
                    color: color,
                    imageUrl: variant.imageUrl && !variant.imageUrl.includes("placeholder")
                      ? variant.imageUrl
                      : null,
                    hasImage: !!(variant.imageUrl && !variant.imageUrl.includes("placeholder")),
                    // تخزين كل المقاسات تحت هذا اللون للرجوع إليها
                    variants: [variant],
                  });
                } else {
                  // أضف هذا المقاس إلى اللون الموجود
                  const existing = colorMap.get(color);
                  existing.variants.push(variant);
                  
                  // إذا كان هذا المقاس له صورة ولم يكن للون صورة بعد، استخدم صورته
                  if (!existing.hasImage && variant.imageUrl && !variant.imageUrl.includes("placeholder")) {
                    existing.imageUrl = variant.imageUrl;
                    existing.hasImage = true;
                    
                    // تحديث item_code إذا كان الصورة تطابق مقاس معين
                    if (variant.item_code) {
                      existing.item_code = variant.item_code;
                    }
                  }
                }
              });
              
              // تحويل الخريطة إلى مصفوفة
              colorMap.forEach((colorItem) => {
                colorItems.push(colorItem);
              });
              
            } else {
              // التعامل مع المنتجات الفردية (بدون ألوان)
              const rawItemCode = group.item_code || group.modelId;
              const itemCodeStr = rawItemCode ? String(rawItemCode) : "N/A";

              colorItems.push({
                uniqueKey: group.modelId,
                id: group.modelId,
                item_code: itemCodeStr,
                master_code: String(group.master_code || "N/A"),
                description: group.description || group.item_name,
                color: "افتراضي",
                imageUrl: null,
                hasImage: false,
                variants: [],
              });
            }
          });

          // تطبيق الفلتر
          let filtered = colorItems;
          if (filterType === "with-image") {
            filtered = filtered.filter((item) => item.hasImage);
          } else if (filterType === "no-image") {
            filtered = filtered.filter((item) => !item.hasImage);
          }

          // تطبيق البحث
          if (searchTerm) {
            filtered = filtered.filter((item) => 
              item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
              item.master_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
              item.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
          }

          setItems(filtered);
          setPagination((prev) => ({
            ...prev,
            page,
            total: data.pagination?.totalProducts || 0,
            totalPages: data.pagination?.totalPages || 1,
          }));
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        addToast("فشل في جلب المنتجات", "error");
      } finally {
        setLoadingProducts(false);
      }
    },
    [searchTerm, filterType, pagination.page, pagination.limit]
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  useEffect(() => {
    if (activeTab === "manage") {
      fetchProducts();
    }
  }, [activeTab, pagination.page]);

  useEffect(() => {
    if (activeTab === "manage") {
      fetchProducts(true);
    }
  }, [searchTerm, filterType]);

  const handleDeleteImage = async (item) => {
    if (!item.imageUrl) return;

    if (
      !confirm(
        `هل أنت متأكد من حذف صورة اللون ${item.color} (${item.item_code})؟`
      )
    ) {
      return;
    }

    setLoadingActionId(item.uniqueKey);

    try {
      const res = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: item.imageUrl,
          productId: String(item.item_code || item.master_code),
        }),
      });

      const result = await res.json();

      if (result.success) {
        addToast("تم حذف الصورة بنجاح", "success");
        setItems((prev) =>
          prev.map((p) => {
            if (p.uniqueKey === item.uniqueKey) {
              return { ...p, imageUrl: null, hasImage: false };
            }
            return p;
          })
        );
      } else {
        addToast(result.error || "فشل الحذف", "error");
      }
    } catch (error) {
      addToast("حدث خطأ في الاتصال", "error");
    } finally {
      setLoadingActionId(null);
    }
  };

  // تنظيف الصور اليتيمة من مستودع R2
  const handleCleanup = async () => {
    if (cleanupConfirmText.trim() !== "نظف") {
      addToast("اكتب كلمة تأكيد بشكل صحيح", "error");
      return;
    }

    setIsCleaning(true);
    try {
      const res = await fetch("/api/images/cleanup", {
        method: "POST",
      });

      const result = await res.json();

      if (result.success) {
        setCleanupReport(result.report);
        addToast(result.message, "success");
        setShowCleanupModal(false);
        setCleanupConfirmText("");
        fetchProducts(true);
      } else {
        addToast(result.error || "فشل تنظيف الصور", "error");
        setShowCleanupModal(false);
        setCleanupConfirmText("");
      }
    } catch (error) {
      addToast("حدث خطأ في الاتصال", "error");
    } finally {
      setIsCleaning(false);
    }
  };

  // استبدال صورة - مع الحفاظ على نفس الاسم (item_code)
  const handleReplaceImage = async (file, item) => {
    const extension = file.name.substring(file.name.lastIndexOf("."));

    // ✅ استخدام item_code الخاص باللون (الذي هو اسم الصورة على R2)
    const codeToUse = item.item_code;

    if (!codeToUse || codeToUse === "N/A" || codeToUse === "null") {
      addToast("لا يوجد كود صالح لهذا اللون لتسمية الصورة", "error");
      return;
    }

    // ✅ تنظيف الكود واستخدامه كاسم للصورة
    const safeCode = String(codeToUse).trim();
    // التأكد من أن الامتداد صحيح
    const safeExtension = extension.startsWith('.') ? extension : `.${extension}`;
    const newFileName = `${safeCode}${safeExtension}`;

    console.log(`📤 جاري رفع الصورة بنفس الاسم: ${newFileName}`);
    console.log(`📍 هذا سيحل محل الصورة القديمة على الرابط: ${item.imageUrl}`);

    const renamedFile = new File([file], newFileName, { type: file.type });
    const formData = new FormData();
    formData.append("file", renamedFile);

    setLoadingActionId(item.uniqueKey);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (result.success) {
        addToast(`تم تحديث صورة اللون ${item.color} بنجاح`, "success");
        const newImageUrl = result.image?.url || result.results?.[0]?.imageUrl;
        
        if (newImageUrl) {
          setItems((prev) =>
            prev.map((p) => {
              if (p.uniqueKey === item.uniqueKey) {
                return { ...p, imageUrl: newImageUrl, hasImage: true };
              }
              return p;
            })
          );
          
          // تحديث الصفحة بعد ثانيتين لرؤية التغييرات
          setTimeout(() => fetchProducts(true), 2000);
        }
      } else {
        addToast(result.error || "فشل الرفع", "error");
      }
    } catch (error) {
      addToast("حدث خطأ أثناء الرفع", "error");
    } finally {
      setLoadingActionId(null);
    }
  };

  // ==========================================
  // Render UI
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              مركز رفع وإدارة الصور
            </h1>
            <p className="text-gray-600 mt-1">
              إدارة الصور المستضافة على Cloudflare R2 - كل لون له صورة واحدة فقط
            </p>
          </div>

          <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 inline-flex">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "upload"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              📤 رفع جماعي
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "manage"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              🖼️ المعرض والإدارة
            </button>
          </div>
        </div>

        {/* ======================= TAB 1: UPLOAD ======================= */}
        {activeTab === "upload" && (
          <div className="space-y-6 animate-fadeIn">
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                isDragging
                  ? "border-blue-500 bg-blue-50 scale-[1.01]"
                  : "border-gray-300 bg-white hover:border-blue-400"
              }`}
            >
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                اسحب وأفلت الصور هنا
              </h3>
              <p className="text-gray-500 mb-6">
                أو اضغط لاختيار الملفات من جهازك. <span className="font-bold text-blue-600">يجب تسمية الملفات بكود اللون بالضبط</span> (مثلاً: <code className="bg-yellow-100 px-2 py-1 rounded font-bold">3700.jpg</code> لكود اللون 3700).
                <br />
                <span className="text-sm text-green-600">✅ عند رفع صورة بنفس الاسم، ستستبدل الصورة القديمة تلقائياً</span>
              </p>

              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all font-bold"
              >
                اختر ملفات الصور
              </button>
            </div>

            {files.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
                <div className="text-gray-700 font-medium">
                  تم اختيار {files.length} ملف (
                  {formatBytes(files.reduce((acc, f) => acc + f.file.size, 0))})
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFiles([])}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                    disabled={isGlobalUploading}
                  >
                    مسح الكل
                  </button>
                  <button
                    onClick={uploadAllFiles}
                    disabled={isGlobalUploading}
                    className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold shadow-md flex items-center gap-2 ${
                      isGlobalUploading ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                  >
                    {isGlobalUploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        جاري الرفع...
                      </>
                    ) : (
                      <>🚀 بدء الرفع (الملفات التي لها نفس الاسم ستستبدل)</>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`bg-white rounded-xl p-3 shadow-sm border relative group transition-all duration-300 ${
                    file.status === "error"
                      ? "border-red-300 bg-red-50"
                      : file.status === "success"
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200"
                  }`}
                >
                  {file.status !== "uploading" && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
                    >
                      ×
                    </button>
                  )}

                  <div className="flex gap-3">
                    <div className="w-20 h-20 relative flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                      <img
                        src={file.preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p
                        className="text-sm font-bold text-gray-800 truncate"
                        title={file.file.name}
                      >
                        {file.file.name}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">
                        {formatBytes(file.file.size)}
                        {file.productCode && (
                          <span className="block text-blue-600 mt-0.5 font-mono font-bold">
                            كود اللون: {file.productCode}
                          </span>
                        )}
                      </p>

                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            file.status === "success"
                              ? "bg-green-500"
                              : file.status === "error"
                              ? "bg-red-500"
                              : "bg-blue-500"
                          }`}
                          style={{ width: `${file.progress}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center mt-1">
                        <span
                          className={`text-[10px] font-semibold ${
                            file.status === "success"
                              ? "text-green-600"
                              : file.status === "error"
                              ? "text-red-600"
                              : "text-blue-600"
                          }`}
                        >
                          {file.status === "uploading"
                            ? "جاري الرفع..."
                            : file.status === "success"
                            ? "تم بنجاح"
                            : file.status === "error"
                            ? "فشل"
                            : "انتظار"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {file.progress}%
                        </span>
                      </div>

                      {file.message && (
                        <p
                          className="text-[10px] mt-1 truncate"
                          title={file.message}
                        >
                          {file.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================= TAB 2: MANAGE ======================= */}
        {activeTab === "manage" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="ابحث بكود اللون، الموديل، أو الاسم..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
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
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border ${
                      filterType === "all"
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setFilterType("with-image")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border ${
                      filterType === "with-image"
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    ✅ لديه صورة
                  </button>
                  <button
                    onClick={() => setFilterType("no-image")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border ${
                      filterType === "no-image"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    ❌ بدون صورة
                  </button>
                  <button
                    onClick={() => {
                      setCleanupReport(null);
                      setCleanupConfirmText("");
                      setShowCleanupModal(true);
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    🧹 تنظيف الصور
                  </button>
                </div>
              </div>
            </div>

            {loadingProducts ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-4 shadow-sm h-80 animate-pulse"
                  >
                    <div className="bg-gray-200 h-48 w-full rounded-lg mb-4"></div>
                    <div className="bg-gray-200 h-4 w-3/4 rounded mb-2"></div>
                    <div className="bg-gray-200 h-4 w-1/2 rounded"></div>
                  </div>
                ))}
              </div>
            ) : items.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {items.map((item) => {
                    const isLoading = loadingActionId === item.uniqueKey;

                    return (
                      <div
                        key={item.uniqueKey}
                        className={`bg-white rounded-xl shadow-sm border overflow-hidden group hover:shadow-lg transition-all duration-300 ${
                          item.hasImage
                            ? "border-gray-200"
                            : "border-red-200 bg-red-50/10"
                        }`}
                      >
                        <div className="relative h-56 bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                          {item.hasImage ? (
                            <div className="relative w-full h-full">
                              <img
                                src={item.imageUrl}
                                alt={item.description}
                                className="w-full h-full object-contain p-2"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                                <a
                                  href={item.imageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 bg-white text-gray-800 rounded-full hover:bg-blue-50 transition-colors shadow-lg"
                                  title="عرض الصورة"
                                >
                                  👁️
                                </a>
                                <button
                                  onClick={() => handleDeleteImage(item)}
                                  className="p-2 bg-white text-red-600 rounded-full hover:bg-red-50 transition-colors shadow-lg"
                                  title="حذف الصورة"
                                  disabled={isLoading}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center text-gray-400">
                              <svg
                                className="w-12 h-12 mb-2 opacity-50"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <span className="text-sm font-medium">
                                لا توجد صورة
                              </span>
                            </div>
                          )}

                          {isLoading && (
                            <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center">
                              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                              <span className="text-xs font-semibold text-blue-600">
                                جاري المعالجة...
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3
                              className="font-bold text-gray-900 line-clamp-1"
                              title={item.description}
                            >
                              {item.description}
                            </h3>
                            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {item.color}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500 mb-4 space-y-1">
                            <p>
                              <strong>كود اللون (اسم الصورة):</strong>{" "}
                              <span className="font-mono bg-yellow-50 px-1 py-0.5 text-gray-800 border border-yellow-200 rounded font-bold">
                                {item.item_code}
                              </span>
                            </p>
                            <p>
                              <strong>المقاسات:</strong>{" "}
                              {item.variants && item.variants.length > 0 
                                ? item.variants.map(v => v.size).filter(Boolean).join('، ') 
                                : "لا يوجد"}
                            </p>
                            <p>الكود الرئيسي: {item.master_code}</p>
                            {item.imageUrl && (
                              <p className="text-xs text-green-600 break-all">
                                <strong>الرابط:</strong> {item.imageUrl}
                              </p>
                            )}
                          </div>

                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              id={`upload-${item.uniqueKey}`}
                              className="hidden"
                              disabled={isLoading}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleReplaceImage(e.target.files[0], item);
                                  e.target.value = ""; // Reset
                                }
                              }}
                            />
                            <label
                              htmlFor={`upload-${item.uniqueKey}`}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold cursor-pointer transition-all ${
                                item.hasImage
                                  ? "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                                  : "bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg"
                              } ${
                                isLoading ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            >
                              {isLoading ? (
                                "جاري الرفع..."
                              ) : item.hasImage ? (
                                <>🔄 استبدال (نفس الاسم: {item.item_code})</>
                              ) : (
                                <>📤 رفع صورة (الاسم: {item.item_code})</>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex justify-center items-center gap-4">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className={`px-4 py-2 rounded-lg border ${
                      pagination.page <= 1
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    ← السابق
                  </button>

                  <span className="text-gray-600 font-medium">
                    صفحة {pagination.page} من {pagination.totalPages}
                  </span>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className={`px-4 py-2 rounded-lg border ${
                      pagination.page >= pagination.totalPages
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    التالي →
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔍</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  لا توجد نتائج
                </h3>
                <p className="text-gray-500 mt-1">
                  جرب البحث بكلمات مختلفة أو تغيير الفلتر.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ======================= CLEANUP MODAL ======================= */}
        {showCleanupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-lg">
                    🧹
                  </span>
                  تنظيف الصور
                </h3>
                <button
                  onClick={() => setShowCleanupModal(false)}
                  disabled={isCleaning}
                  className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-red-800 font-medium mb-2">
                  ⚠️ تحذير: هذا الإجراء سيقوم بحذف جميع الصور في مستودع Cloudflare
                  R2 التي لا يستخدمها أي منتج أو تصنيف أو شعار في المتجر.
                </p>
                <p className="text-xs text-red-600">
                  لن يتم حذف صور المنتجات الظاهرة أو المستخدمة حالياً.
                </p>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                اكتب كلمة <span className="font-bold text-red-600">نظف</span> للتأكيد
              </label>
              <input
                type="text"
                value={cleanupConfirmText}
                onChange={(e) => setCleanupConfirmText(e.target.value)}
                disabled={isCleaning}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4 text-center text-lg font-bold"
                placeholder="نظف"
              />

              <div className="flex gap-3">
                <button
                  onClick={handleCleanup}
                  disabled={isCleaning || cleanupConfirmText.trim() !== "نظف"}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold text-white transition-all ${
                    isCleaning || cleanupConfirmText.trim() !== "نظف"
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isCleaning ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                      جاري التنظيف...
                    </span>
                  ) : (
                    "نظف الآن"
                  )}
                </button>
                <button
                  onClick={() => setShowCleanupModal(false)}
                  disabled={isCleaning}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}