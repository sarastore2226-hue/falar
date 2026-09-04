"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";

export default function CompanyManagement() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false); // ✅ حالة رفع الشعار

  // بيانات الشركة
  const [companyData, setCompanyData] = useState({
    company_name: "",
    address: "",
    logo: "",
    email: "",
    facebook_url: "",
    instagram_url: "",
    tiktok_url: "",
    phone1: "",
    phone2: "",
    phone3: "",
    terms_conditions: "",
  });

  useEffect(() => {
    const checkAdmin = () => {
      try {
        const employee = localStorage.getItem("employee");
        const employeeToken = localStorage.getItem("employeeToken");

        if (!employee || !employeeToken) {
          router.push("/login");
          return;
        }

        const userData = JSON.parse(employee);
        if (userData.position !== "مدير") {
          router.push("/");
          return;
        }

        setUser(userData);
        fetchCompanyInfo();
      } catch (error) {
        console.error("Error:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [router]);

  const fetchCompanyInfo = async () => {
    try {
      const response = await fetch("/api/company");
      const data = await response.json();
      setCompanyInfo(data);
      setCompanyData((currentData) => ({
        ...currentData,
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, value ?? ""])
        ),
      }));
    } catch (error) {
      console.error("Error fetching company info:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/company", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyData),
      });

      const result = await response.json();
      if (result.success) {
        setIsEditing(false);
        fetchCompanyInfo();
        alert("✅ تم تحديث معلومات الشركة بنجاح");
      } else {
        alert("❌ فشل في تحديث المعلومات");
      }
    } catch (error) {
      console.error("Error updating company:", error);
      alert("❌ حدث خطأ أثناء التحديث");
    }
  };

  // ✅ دالة رفع الشعار المعدلة (Cloudflare R2)
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append("file", file);

      // استخدام API الرفع الموجود بالفعل
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // ✅ استخدام الرابط الدائم من R2
        // بما أن الـ API قد يعيد هيكل مختلف (مفرد أو جمع)، نتحقق من الحالتين
        const imageUrl = result.image?.url || result.results?.[0]?.imageUrl;
        
        if (imageUrl) {
          setCompanyData({ ...companyData, logo: imageUrl });
          alert("✅ تم رفع الشعار بنجاح");
        } else {
          throw new Error("لم يتم العثور على رابط الصورة في الاستجابة");
        }
      } else {
        throw new Error(result.error || "فشل الرفع");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("❌ فشل في رفع الشعار: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* رأس الصفحة */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                إدارة معلومات الشركة
              </h1>
              <p className="text-gray-600 mt-2">
                تعديل معلومات المتجر والشعار والاتصال
              </p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isEditing
                  ? "bg-gray-600 text-white hover:bg-gray-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isEditing ? "إلغاء التعديل" : "تعديل المعلومات"}
            </button>
          </div>
        </div>

        {/* نموذج معلومات الشركة */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit}>
            <div className="space-y-8">
              {/* المعلومات الأساسية */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  المعلومات الأساسية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      اسم الشركة *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyData.company_name}
                      onChange={(e) =>
                        setCompanyData({
                          ...companyData,
                          company_name: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      البريد الإلكتروني
                    </label>
                    <input
                      type="email"
                      value={companyData.email}
                      onChange={(e) =>
                        setCompanyData({
                          ...companyData,
                          email: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* الشعار */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  شعار الشركة
                </h3>
                <div className="flex items-center space-x-6 space-x-reverse">
                  <div className="w-32 h-32 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative">
                    {uploadingLogo ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : companyData.logo ? (
                      <img
                        src={companyData.logo}
                        alt="شعار الشركة"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">
                        لا يوجد شعار
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    {isEditing && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingLogo}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className={`inline-block px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                            uploadingLogo
                              ? "bg-gray-400 text-white cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {uploadingLogo ? "جاري الرفع..." : "رفع شعار جديد"}
                        </label>
                        <p className="text-sm text-gray-500 mt-2">
                          سيتم رفع الشعار وحفظه بشكل دائم.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* وسائل التواصل الاجتماعي */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  وسائل التواصل الاجتماعي
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      فيسبوك
                    </label>
                    <input
                      type="url"
                      value={companyData.facebook_url}
                      onChange={(e) =>
                        setCompanyData({
                          ...companyData,
                          facebook_url: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      placeholder="https://facebook.com/yourpage"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      إنستجرام
                    </label>
                    <input
                      type="url"
                      value={companyData.instagram_url}
                      onChange={(e) =>
                        setCompanyData({
                          ...companyData,
                          instagram_url: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      placeholder="https://instagram.com/yourpage"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      تيك توك
                    </label>
                    <input
                      type="url"
                      value={companyData.tiktok_url}
                      onChange={(e) =>
                        setCompanyData({
                          ...companyData,
                          tiktok_url: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      placeholder="https://tiktok.com/@yourpage"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* أرقام الهاتف */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  أرقام الهاتف
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الهاتف 1
                    </label>
                    <input
                      type="tel"
                      value={companyData.phone1}
                      onChange={(e) =>
                        setCompanyData({
                          ...companyData,
                          phone1: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الهاتف 2
                    </label>
                    <input
                      type="tel"
                      value={companyData.phone2}
                      onChange={(e) =>
                        setCompanyData({
                          ...companyData,
                          phone2: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الهاتف 3
                    </label>
                    <input
                      type="tel"
                      value={companyData.phone3}
                      onChange={(e) =>
                        setCompanyData({
                          ...companyData,
                          phone3: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* العنوان */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  العنوان
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العنوان الكامل
                  </label>
                  <textarea
                    rows={3}
                    value={companyData.address}
                    onChange={(e) =>
                      setCompanyData({
                        ...companyData,
                        address: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* الشروط والأحكام */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  الشروط والأحكام
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الشروط والأحكام
                  </label>
                  <textarea
                    rows={6}
                    value={companyData.terms_conditions}
                    onChange={(e) =>
                      setCompanyData({
                        ...companyData,
                        terms_conditions: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* زر الحفظ */}
              {isEditing && (
                <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setCompanyData(companyInfo); // إعادة تعيين البيانات
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingLogo}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingLogo ? "جاري رفع الشعار..." : "حفظ التغييرات"}
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}