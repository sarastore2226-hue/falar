"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Header from "../../components/Header";

// ==========================================
// Helper Components
// ==========================================

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
  const [bulkApplyToAllColors, setBulkApplyToAllColors] = useState(false);

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

  // --- State: Image Linking Rules Tab ---
  const [linkRules, setLinkRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isSyncingAllRules, setIsSyncingAllRules] = useState(false);
  const [linkForm, setLinkForm] = useState({
    rawInput: "",
    name: "",
    suffixMode: "AUTO",
    fallbackAnyColor: true,
    overwriteExisting: false,
  });
  const [linkPreview, setLinkPreview] = useState(null);

  // ==========================================
  // Helper Functions
  // ==========================================
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = "info") => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => removeToast(id), 5000);
    },
    [removeToast]
  );

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
    const newFiles = Array.from(fileList).map((file) => {
      const dotIdx = file.name.lastIndexOf(".");
      const productCode = dotIdx > 0 ? file.name.substring(0, dotIdx) : file.name;
      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: "pending",
        productCode,
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // ==========================================
  // Tab 2 Logic: Manage & Gallery
  // ==========================================
  const fetchProducts = useCallback(
    async (targetPage = 1) => {
      setLoadingProducts(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(targetPage),
          limit: String(pagination.limit),
          search: searchTerm,
          employee: "true",
        });

        const res = await fetch(`/api/products?${queryParams.toString()}`);
        const data = await res.json();

        if (data.success && data.products) {
          const colorItems = [];

          data.products.forEach((group) => {
            if (group.variants && group.variants.length > 0) {
              const colorMap = new Map();

              group.variants.forEach((variant) => {
                const color = variant.color || "افتراضي";
                const variantCode =
                  variant.item_code ||
                  variant.itemCode ||
                  (group.master_code ? `${group.master_code}-${color}` : "");
                const variantHasImage =
                  variant.hasImage !== undefined
                    ? Boolean(variant.hasImage)
                    : !!(
                        variant.imageUrl &&
                        !variant.imageUrl.includes("placeholder")
                      );

                if (!colorMap.has(color)) {
                  colorMap.set(color, {
                    uniqueKey: `${group.master_code}-${color}`,
                    master_code: String(group.master_code || "N/A"),
                    item_code: variantCode,
                    imageFileName: variant.imageFileName || variantCode,
                    description: group.description || group.item_name,
                    color: color,
                    imageUrl: variantHasImage ? variant.imageUrl : null,
                    hasImage: variantHasImage,
                    variants: [variant],
                  });
                } else {
                  const existing = colorMap.get(color);
                  existing.variants.push(variant);

                  if (!existing.hasImage && variantHasImage && variant.imageUrl) {
                    existing.imageUrl = variant.imageUrl;
                    existing.hasImage = true;

                    if (variantCode) {
                      existing.item_code = variantCode;
                    }
                  }
                }
              });

              colorMap.forEach((colorItem) => {
                colorItems.push(colorItem);
              });
            } else {
              const rawItemCode =
                group.item_code || group.itemCode || group.modelId;
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

          let filtered = colorItems;
          if (filterType === "with-image") {
            filtered = filtered.filter((item) => item.hasImage);
          } else if (filterType === "no-image") {
            filtered = filtered.filter((item) => !item.hasImage);
          }

          if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
              (item) =>
                item.item_code.toLowerCase().includes(term) ||
                item.master_code.toLowerCase().includes(term) ||
                (item.description || "").toLowerCase().includes(term) ||
                (item.color || "").toLowerCase().includes(term)
            );
          }

          setItems(filtered);
          setPagination((prev) => ({
            ...prev,
            total: data.pagination?.totalProducts || 0,
            totalPages: data.pagination?.totalPages || 1,
          }));
        }
      } catch (err) {
        console.error("Error fetching products:", err);
        addToast("فشل في جلب المنتجات", "error");
      } finally {
        setLoadingProducts(false);
      }
    },
    [searchTerm, filterType, pagination.limit, addToast]
  );

  useEffect(() => {
    if (activeTab === "manage") {
      fetchProducts(pagination.page);
    }
  }, [activeTab, pagination.page, fetchProducts]);

  // ==========================================
  // Tab 3 Logic: Image Linking Rules
  // ==========================================
  const fetchLinkRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await fetch("/api/image-links");
      const data = await res.json();
      if (data.success && Array.isArray(data.rules)) {
        setLinkRules(data.rules);
      }
    } catch {
      addToast("فشل جلب قواعد الربط", "error");
    } finally {
      setLoadingRules(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (activeTab === "links") {
      fetchLinkRules();
    }
  }, [activeTab, fetchLinkRules]);

  useEffect(() => {
    if (activeTab !== "links") return;
    if (!linkForm.rawInput.trim()) {
      setLinkPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/image-links?preview=${encodeURIComponent(
            linkForm.rawInput
          )}&suffixMode=${linkForm.suffixMode}`
        );
        const data = await res.json();
        if (data.success) {
          setLinkPreview(data);
        }
      } catch {
        setLinkPreview(null);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [activeTab, linkForm.rawInput, linkForm.suffixMode]);

  const handleSaveLinkRule = async (e) => {
    e.preventDefault();
    if (!linkForm.rawInput.trim()) return;

    setIsSavingRule(true);
    try {
      const res = await fetch("/api/image-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(linkForm),
      });
      const data = await res.json();
      if (data.success) {
        addToast(data.message || "تم حفظ قاعدة الربط وتطبيقها", "success");
        setLinkForm({
          rawInput: "",
          name: "",
          suffixMode: "AUTO",
          fallbackAnyColor: true,
          overwriteExisting: false,
        });
        setLinkPreview(null);
        fetchLinkRules();
      } else {
        addToast(data.error || "فشل حفظ القاعدة", "error");
      }
    } catch {
      addToast("حدث خطأ أثناء الحفظ", "error");
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleSyncRule = async (ruleId = null) => {
    setIsSyncingAllRules(true);
    try {
      const res = await fetch("/api/image-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ruleId }),
      });
      const data = await res.json();
      if (data.success) {
        addToast(data.message || "تمت المزامنة بنجاح", "success");
      } else {
        addToast(data.error || "فشلت المزامنة", "error");
      }
    } catch {
      addToast("حدث خطأ أثناء المزامنة", "error");
    } finally {
      setIsSyncingAllRules(false);
    }
  };

  const handleToggleRuleActive = async (rule) => {
    try {
      const res = await fetch("/api/image-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, active: !rule.active }),
      });
      const data = await res.json();
      if (data.success) {
        setLinkRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r))
        );
      }
    } catch {
      addToast("تعذر تحديث حالة القاعدة", "error");
    }
  };

  const handleDeleteRule = async (id) => {
    if (!confirm("هل تريد حذف قاعدة الربط هذه؟ (لن يتم حذف الصور المربوطة حالياً)")) {
      return;
    }
    try {
      const res = await fetch(`/api/image-links?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        addToast("تم حذف القاعدة", "success");
        setLinkRules((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      addToast("فشل حذف القاعدة", "error");
    }
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  };

  const handleFilterChange = (type) => {
    setFilterType(type);
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
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
      if (bulkApplyToAllColors) {
        formData.append("applyToAllColors", "true");
      }

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

          if (activeTab === "manage") {
            setTimeout(() => fetchProducts(pagination.page), 1000);
          }
        } else {
          throw new Error(data.error || "فشل الرفع");
        }
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, status: "error", progress: 0, message: err.message }
              : f
          )
        );
      }
    }

    setIsGlobalUploading(false);
    addToast("اكتملت عملية المعالجة", "info");
  };

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
            if (p.uniqueKey === item.uniqueKey || p.imageUrl === item.imageUrl) {
              return { ...p, imageUrl: null, hasImage: false };
            }
            return p;
          })
        );
      } else {
        addToast(result.error || "فشل الحذف", "error");
      }
    } catch {
      addToast("حدث خطأ في الاتصال", "error");
    } finally {
      setLoadingActionId(null);
    }
  };

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
        fetchProducts(pagination.page);
      } else {
        addToast(result.error || "فشل تنظيف الصور", "error");
        setShowCleanupModal(false);
        setCleanupConfirmText("");
      }
    } catch {
      addToast("حدث خطأ في الاتصال", "error");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleReplaceImage = async (file, item, applyToAllColors = false) => {
    const lastDot = file.name.lastIndexOf(".");
    const extension = lastDot !== -1 ? file.name.substring(lastDot) : ".jpg";
    const safeExtension = extension.startsWith(".")
      ? extension
      : `.${extension}`;

    const fallbackCode =
      item.master_code && item.master_code !== "N/A"
        ? `${item.master_code}-${item.color}`
        : "";
    const codeToUse = applyToAllColors
      ? item.master_code
      : item.item_code || fallbackCode;

    if (!codeToUse || codeToUse === "N/A" || codeToUse === "null") {
      addToast("لا يوجد كود صالح لهذا اللون لتسمية الصورة", "error");
      return;
    }

    const safeCode = String(codeToUse).trim();
    const newFileName = `${safeCode}${safeExtension}`;
    const renamedFile = new File([file], newFileName, { type: file.type });

    const formData = new FormData();
    formData.append("file", renamedFile);
    if (applyToAllColors && item.master_code && item.master_code !== "N/A") {
      formData.append("applyToAllColors", "true");
      formData.append("targetModelNo", item.master_code);
    }

    setLoadingActionId(item.uniqueKey);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (result.success) {
        addToast(result.message || "تم رفع الصورة بنجاح", "success");
        const newImageUrl = result.image?.url || result.results?.[0]?.imageUrl;

        if (newImageUrl) {
          setItems((prev) =>
            prev.map((p) => {
              const matchesRow = applyToAllColors
                ? p.master_code === item.master_code
                : p.uniqueKey === item.uniqueKey;

              if (matchesRow) {
                return { ...p, imageUrl: newImageUrl, hasImage: true };
              }
              return p;
            })
          );

          setTimeout(() => fetchProducts(pagination.page), 1500);
        }
      } else {
        addToast(result.error || "فشل الرفع", "error");
      }
    } catch {
      addToast("حدث خطأ أثناء الرفع", "error");
    } finally {
      setLoadingActionId(null);
    }
  };

  // ==========================================
  // Render UI
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 pb-20" dir="rtl">
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
              رفع الصور على Cloudflare R2 وربط صور المراحل تلقائياً بين الموديلات
            </p>
          </div>

          <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 inline-flex flex-wrap gap-1">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "upload"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              📤 رفع جماعي
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "manage"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              🖼️ المعرض والإدارة
            </button>
            <button
              onClick={() => setActiveTab("links")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "links"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-indigo-700 hover:bg-indigo-50"
              }`}
            >
              🔗 ربط الصور (المراحل)
            </button>
          </div>
        </div>

        {/* ======================= TAB 1: UPLOAD ======================= */}
        {activeTab === "upload" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bulkApplyToAllColors}
                  onChange={(e) => setBulkApplyToAllColors(e.target.checked)}
                  className="w-5 h-5 text-purple-600 rounded cursor-pointer"
                />
                <div>
                  <span className="font-bold text-purple-900 text-sm block">
                    📢 وضع الصور المجمعة (تطبيق الصورة على كل ألوان الموديل)
                  </span>
                  <span className="text-xs text-purple-700">
                    فعّله إذا كانت الصور المرفوعة مجمعة وتريد وضع كل صورة على جميع ألوان موديلها (مع تطبيق قواعد الربط التلقائي للمراحل إن وجدت).
                  </span>
                </div>
              </label>
            </div>

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
                للون محدد سمِّ الصورة:{" "}
                <code className="bg-yellow-100 px-2 py-1 rounded font-bold">
                  3700-أسود.webp
                </code>{" "}
                — ولصورة مجمعة لكل ألوان الموديل:{" "}
                <code className="bg-purple-100 text-purple-900 px-2 py-1 rounded font-bold">
                  3700.webp
                </code>
                <br />
                <span className="text-sm text-green-600">
                  ✅ يتم ربط الصورة تلقائياً بالصنف وبأي موديل شقيق مُعرَّف في تبويب &quot;ربط الصور&quot;
                </span>
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
                      <>🚀 بدء الرفع</>
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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
                            الكود: {file.productCode}
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
                    onChange={(e) => handleSearchChange(e.target.value)}
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
                    onClick={() => handleFilterChange("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border ${
                      filterType === "all"
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => handleFilterChange("with-image")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border ${
                      filterType === "with-image"
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    ✅ لديه صورة
                  </button>
                  <button
                    onClick={() => handleFilterChange("no-image")}
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

            {cleanupReport && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex flex-wrap gap-4 justify-between items-center">
                <span>
                  🧹 تقرير التنظيف: الإجمالي {cleanupReport.total} | تم حذف{" "}
                  {cleanupReport.deleted} | تم الإبقاء على {cleanupReport.kept}
                </span>
                <button
                  onClick={() => setCleanupReport(null)}
                  className="text-xs font-bold underline"
                >
                  إخفاء
                </button>
              </div>
            )}

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
                    const sizesText =
                      item.variants && item.variants.length > 0
                        ? item.variants
                            .map(
                              (v) =>
                                v.size ||
                                (Array.isArray(v.sizes)
                                  ? v.sizes.join("، ")
                                  : "")
                            )
                            .filter(Boolean)
                            .join("، ")
                        : "";

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
                              {/* eslint-disable-next-line @next/next/no-img-element */}
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
                              <strong>المقاسات:</strong> {sizesText || "لا يوجد"}
                            </p>
                            <p>الكود الرئيسي: {item.master_code}</p>
                            {item.imageUrl && (
                              <p className="text-xs text-green-600 break-all">
                                <strong>الرابط:</strong> {item.imageUrl}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                id={`upload-${item.uniqueKey}`}
                                className="hidden"
                                disabled={isLoading}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleReplaceImage(
                                      e.target.files[0],
                                      item,
                                      false
                                    );
                                    e.target.value = "";
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
                                  <>🔄 استبدال ({item.color})</>
                                ) : (
                                  <>📤 رفع للون ({item.color})</>
                                )}
                              </label>
                            </div>

                            {item.master_code && item.master_code !== "N/A" && (
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`upload-all-${item.uniqueKey}`}
                                  className="hidden"
                                  disabled={isLoading}
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleReplaceImage(
                                        e.target.files[0],
                                        item,
                                        true
                                      );
                                      e.target.value = "";
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`upload-all-${item.uniqueKey}`}
                                  className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 ${
                                    isLoading
                                      ? "opacity-50 cursor-not-allowed"
                                      : ""
                                  }`}
                                >
                                  📢 تعميم صورة على كل ألوان {item.master_code}
                                </label>
                              </div>
                            )}
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

        {/* ======================= TAB 3: IMAGE LINKING RULES ======================= */}
        {activeTab === "links" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* نموذج إضافة قاعدة ربط جديدة */}
              <form
                onSubmit={handleSaveLinkRule}
                className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-6 space-y-4 h-fit"
              >
                <div>
                  <h2 className="text-xl font-bold text-indigo-900">
                    🔗 إضافة قاعدة ربط صور جديدة
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    أدخل الأرقام الأم لمراحل الموديل (بيبي / وسط / محير)، وسيأخذ أي
                    موديل منها رابط الصورة المتاح في أي مرحلة أخرى تلقائياً.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    الأرقام الأم الأولية للمراحل *
                  </label>
                  <input
                    type="text"
                    required
                    value={linkForm.rawInput}
                    onChange={(e) =>
                      setLinkForm({ ...linkForm, rawInput: e.target.value })
                    }
                    placeholder="مثال: 300, 400, 500 أو 3700, 4700, 5700 أو w1000, w2000"
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    يمكنك الفصل بفاصلة أو <b>و</b> أو مسافة (مثال: <code>600 و 700</code> أو <code>3700, 4700, 5700</code> أو <code>w1099, w2099</code>)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    طول الخانات المتغيرة
                  </label>
                  <select
                    value={linkForm.suffixMode}
                    onChange={(e) =>
                      setLinkForm({ ...linkForm, suffixMode: e.target.value })
                    }
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-semibold bg-white"
                  >
                    <option value="AUTO">
                      تلقائي حسب الأصفار (موصى به: 300↔400، 3700↔4700، w1000↔w2000)
                    </option>
                    <option value="2">آخر رقمين فقط (00 إلى 99)</option>
                    <option value="3">آخر 3 أرقام (000 إلى 999)</option>
                    <option value="0">تطابق حرفي للأكواد فقط (بدون نطاق)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    اسم توضيحي للقاعدة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={linkForm.name}
                    onChange={(e) =>
                      setLinkForm({ ...linkForm, name: e.target.value })
                    }
                    placeholder="مثال: مراحل الجيبات 3700-4700-5700"
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-start gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkForm.fallbackAnyColor}
                      onChange={(e) =>
                        setLinkForm({
                          ...linkForm,
                          fallbackAnyColor: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>
                      إذا اختلف اسم اللون، استخدم أول صورة متوفرة للموديل المرتبط كبديل
                    </span>
                  </label>

                  <label className="flex items-start gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkForm.overwriteExisting}
                      onChange={(e) =>
                        setLinkForm({
                          ...linkForm,
                          overwriteExisting: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>
                      تحديث الأصناف حتى لو كان لديها صورة سابقة
                    </span>
                  </label>
                </div>

                {/* معاينة حية */}
                {linkPreview && (
                  <div
                    className={`rounded-xl p-3 text-xs border ${
                      linkPreview.valid
                        ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {linkPreview.valid ? (
                      <div className="space-y-1">
                        <div className="font-bold">
                          ✅ مثال التطابق:{` `}
                          <span className="font-mono" dir="ltr">
                            {linkPreview.exampleGroup?.join(" ↔ ")}
                          </span>
                        </div>
                        <div>
                          تم العثور على{" "}
                          <b>{linkPreview.matchedModelsCount}</b> موديل مطابق في
                          قاعدة البيانات (منهم{" "}
                          <b>{linkPreview.modelsWithoutImageCount}</b> بدون
                          صورة حالياً).
                        </div>
                      </div>
                    ) : (
                      <div className="font-bold">⚠️ {linkPreview.error}</div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSavingRule || !linkPreview?.valid}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isSavingRule
                    ? "جاري الحفظ والتطبيق..."
                    : "🔗 حفظ القاعدة وتطبيق الربط الآن"}
                </button>
              </form>

              {/* قائمة القواعد المحفوظة */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      قواعد الربط المحفوظة ({linkRules.length})
                    </h3>
                    <p className="text-xs text-gray-500">
                      تعمل هذه القواعد تلقائياً عند رفع أي صورة جديدة في أي وقت
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSyncingAllRules || linkRules.length === 0}
                    onClick={() => handleSyncRule(null)}
                    className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold shadow disabled:bg-gray-300"
                  >
                    {isSyncingAllRules
                      ? "جاري المزامنة..."
                      : "🔄 مزامنة وتطبيق الكل الآن"}
                  </button>
                </div>

                {loadingRules ? (
                  <p className="text-center py-8 text-gray-500 text-sm">
                    جاري تحميل القواعد...
                  </p>
                ) : linkRules.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    <div className="text-4xl mb-2">🔗</div>
                    <p className="font-bold text-sm">
                      لم تُضف أي قواعد ربط بعد
                    </p>
                    <p className="text-xs mt-1">
                      أضف أول قاعدة من النموذج (مثل: 300, 400, 500 أو 3700, 4700, 5700)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {linkRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                          rule.active
                            ? "bg-white border-indigo-100"
                            : "bg-gray-50 border-gray-200 opacity-70"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900">
                              {rule.name || rule.raw_input}
                            </span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                rule.active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-200 text-gray-600"
                              }`}
                            >
                              {rule.active ? "فعالة تلقائياً" : "متوقفة"}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 flex flex-wrap gap-2 items-center">
                            <span>الإدخال: {rule.raw_input}</span>
                            <span>•</span>
                            <span>
                              البادئات:{" "}
                              <code className="bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-mono">
                                {(rule.prefixesList || []).join(" , ")}
                              </code>
                            </span>
                            <span>•</span>
                            <span>
                              الخانات المتغيرة:{" "}
                              {rule.suffix_length === 0
                                ? "مطابقة تامة"
                                : `${rule.suffix_length} خانات`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={isSyncingAllRules}
                            onClick={() => handleSyncRule(rule.id)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
                          >
                            🔄 مزامنة
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleRuleActive(rule)}
                            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold"
                          >
                            {rule.active ? "إيقاف" : "تفعيل"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
                اكتب كلمة <span className="font-bold text-red-600">نظف</span>{" "}
                للتأكيد
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