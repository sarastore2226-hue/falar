"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";

export default function CategoriesManagement() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    image: "",
    kind: "جنس", // القيمة الافتراضية
    sub: "",
  });
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/categories/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setFormData((prev) => ({ ...prev, image: result.image.url }));
        alert("تم رفع الصورة بنجاح");
      } else {
        alert(result.error || "فشل في رفع الصورة");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("فشل في رفع الصورة");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/categories");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ الحصول على التصنيفات الرئيسية (نوع "جنس") فقط
  const getParentCategories = () => {
    return categories.filter((category) => category.kind === "جنس");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingCategory ? "/api/categories" : "/api/categories";
      const method = editingCategory ? "PUT" : "POST";

      // ✅ تعديل المنطق: "جنس" و "خلفية" لا يحتاجان إلى sub
      const needsSub = formData.kind === "نوع";
      
      const submitData = {
        ...formData,
        sub: needsSub ? formData.sub : "",
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editingCategory
            ? { id: editingCategory.id, ...submitData }
            : submitData
        ),
      });

      const result = await response.json();

      if (result.success) {
        alert(result.message);
        setShowForm(false);
        setEditingCategory(null);
        setFormData({ name: "", image: "", kind: "جنس", sub: "" });
        fetchCategories();
      } else {
        alert(result.error);
      }
    } catch (error) {
      alert("فشل في حفظ التصنيف");
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      image: category.image || "",
      kind: category.kind,
      sub: category.sub || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("هل أنت متأكد من حذف هذا التصنيف؟")) return;

    try {
      const response = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        alert(result.message);
        fetchCategories();
      } else {
        alert(result.error);
      }
    } catch (error) {
      alert("فشل في حذف التصنيف");
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCategory(null);
    setFormData({ name: "", image: "", kind: "جنس", sub: "" });
  };

  // ✅ عند تغيير نوع التصنيف
  const handleKindChange = (kind) => {
    setFormData({
      ...formData,
      kind,
      // تصفير التصنيف الفرعي إذا لم يكن النوع "نوع"
      sub: kind === "نوع" ? formData.sub : "",
    });
  };

  // دالة مساعدة لتحديد لون الشارة بناءً على النوع
  const getKindBadgeColor = (kind) => {
    switch (kind) {
      case "جنس": return "bg-blue-100 text-blue-800";
      case "نوع": return "bg-green-100 text-green-800";
      case "خلفية": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* رأس الصفحة */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                إدارة التصنيفات
              </h1>
              <p className="text-gray-600 mt-2">إضافة، تعديل وحذف التصنيفات</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + إضافة تصنيف جديد
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* قائمة التصنيفات */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  التصنيفات ({categories.length})
                </h2>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">جاري تحميل التصنيفات...</p>
                </div>
              ) : categories.length > 0 ? (
                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          التصنيف
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          النوع
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          التصنيف الرئيسي
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          الإجراءات
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {categories.map((category) => (
                        <tr key={category.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {category.image && (
                                <img
                                  src={category.image}
                                  alt={category.name}
                                  className="w-10 h-10 rounded-lg object-cover ml-3 border border-gray-200"
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {category.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  ID: {category.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getKindBadgeColor(category.kind)}`}
                            >
                              {category.kind}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {category.sub ? (
                              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                                {category.sub}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(category)}
                                className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                              >
                                تعديل
                              </button>
                              <button
                                onClick={() => handleDelete(category.id)}
                                className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition-colors"
                              >
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">📁</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    لا توجد تصنيفات
                  </h3>
                  <p className="text-gray-600">
                    ابدأ بإضافة تصنيفات جديدة للمتجر
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* نموذج الإضافة/التعديل */}
          {showForm && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingCategory ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
                  </h3>
                  <button
                    onClick={resetForm}
                    className="text-gray-500 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      اسم التصنيف *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="أدخل اسم التصنيف"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      صورة التصنيف
                    </label>

                    {/* زر رفع الصورة من الجهاز */}
                    <div className="flex items-center gap-2 mb-2">
                      <label className="flex-1 cursor-pointer">
                        <span className={`flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg text-sm font-medium transition-colors ${
                          uploading
                            ? "border-blue-300 bg-blue-50 text-blue-500"
                            : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}>
                          {uploading ? (
                            <>
                              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></span>
                              جاري الرفع...
                            </>
                          ) : (
                            <>
                              <span>📤</span>
                              رفع صورة من الجهاز
                            </>
                          )}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* معاينة الصورة المرفوعة */}
                    {formData.image && (
                      <div className="mb-2 flex items-center gap-2">
                        <img
                          src={formData.image}
                          alt="معاينة الصورة"
                          className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, image: "" })
                          }
                          className="text-red-600 hover:text-red-800 text-xs bg-red-50 px-2 py-1 rounded"
                        >
                          إزالة الصورة
                        </button>
                      </div>
                    )}

                    <input
                      type="url"
                      value={formData.image}
                      onChange={(e) =>
                        setFormData({ ...formData, image: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.kind === "خلفية"
                        ? "ارفع صورة البانر (الهيرو) الرئيسية من جهازك أو الصق رابطها"
                        : "ارفع أيقونة أو صورة التصنيف من جهازك أو الصق رابطها"}
                    </p>
                  </div>

                  {/* ✅ حقل النوع المحدث - إضافة خيار خلفية */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      النوع *
                    </label>
                    <select
                      required
                      value={formData.kind}
                      onChange={(e) => handleKindChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="جنس">جنس (تصنيف رئيسي)</option>
                      <option value="نوع">نوع (تصنيف فرعي)</option>
                      <option value="خلفية">خلفية (صور الهيرو)</option>
                    </select>
                    
                    {/* شرح توضيحي ديناميكي */}
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                      {formData.kind === "جنس" && "التصنيفات الرئيسية مثل: أولاد، بنات"}
                      {formData.kind === "نوع" && "التصنيفات الفرعية مثل: تيشيرت، بنطلون (تتطلب تصنيف رئيسي)"}
                      {formData.kind === "خلفية" && "صور العرض الرئيسية (Banners) في الصفحة الرئيسية"}
                    </div>
                  </div>

                  {/* ✅ حقل التصنيف الفرعي (يظهر فقط للنوع "نوع") */}
                  <div className={`transition-all duration-300 ${formData.kind !== "نوع" ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.kind === "نوع" ? "التصنيف الرئيسي *" : "التصنيف الرئيسي"}
                    </label>
                    <select
                      value={formData.sub}
                      onChange={(e) =>
                        setFormData({ ...formData, sub: e.target.value })
                      }
                      disabled={formData.kind !== "نوع"}
                      required={formData.kind === "نوع"}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formData.kind !== "نوع" ? "bg-gray-100 text-gray-400" : ""
                      }`}
                    >
                      <option value="">
                        {formData.kind !== "نوع"
                          ? "غير مطلوب لهذا النوع"
                          : "اختر التصنيف الرئيسي"}
                      </option>
                      {getParentCategories().map((parent) => (
                        <option key={parent.id} value={parent.name}>
                          {parent.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      {editingCategory ? "تحديث" : "إضافة"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 bg-white text-gray-700 border border-gray-300 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}