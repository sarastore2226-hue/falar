"use client";

import { useEffect, useState } from "react";
import Header from "@/app/components/Header";

const emptyTier = { min_quantity: 1, bundle_price: 0 };

export default function PromotionsPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", category_id: "", active: true });
  const [tiers, setTiers] = useState([{ ...emptyTier }]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadData = async () => {
    const [categoriesResponse, promotionsResponse] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/promotions"),
    ]);
    setCategories(await categoriesResponse.json());
    setPromotions(await promotionsResponse.json());
  };

  useEffect(() => { loadData(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/promotions", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...(editingId ? { id: editingId } : {}),
          category_id: Number(form.category_id),
          tiers,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setForm({ name: "", category_id: "", active: true });
      setTiers([{ ...emptyTier }]);
      setEditingId(null);
      await loadData();
    } catch (error: any) {
      alert(error.message || "فشل حفظ العرض");
    } finally {
      setLoading(false);
    }
  };

  const editPromotion = (promotion: any) => {
    setEditingId(promotion.id);
    setForm({
      name: promotion.name,
      category_id: String(promotion.category_id),
      active: promotion.active,
    });
    setTiers(
      promotion.tiers.map((tier: any) => ({
        min_quantity: Number(tier.min_quantity),
        bundle_price: Number(tier.bundle_price),
      }))
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", category_id: "", active: true });
    setTiers([{ ...emptyTier }]);
  };

  const deletePromotion = async (id: number) => {
    if (!confirm("هل تريد حذف هذا العرض؟")) return;
    await fetch(`/api/promotions?id=${id}`, { method: "DELETE" });
    await loadData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8" dir="rtl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">إدارة العروض</h1>
        <p className="text-gray-600 mb-8">أضف أسعار الباقات لكل تصنيف، مثل: قطعتان بـ 470 جنيه.</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <form onSubmit={submit} className="bg-white rounded-2xl border border-red-100 p-6 shadow-[0_12px_35px_rgba(220,38,38,0.08)] space-y-5 h-fit">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? "تعديل العرض" : "إضافة عرض"}
              </h2>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="text-sm font-semibold text-gray-500 hover:text-gray-800">
                  إلغاء التعديل
                </button>
              )}
            </div>
            <label className="block">اسم العرض<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2" placeholder="عرض الشورت البناتي" /></label>
            <label className="block">التصنيف<select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2"><option value="">اختر التصنيف</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <div>
              <div className="flex justify-between items-center mb-2"><span className="font-medium">شرائح الأسعار</span><button type="button" onClick={() => setTiers([...tiers, { min_quantity: 1, bundle_price: 0 }])} className="text-blue-600">+ شريحة</button></div>
              <div className="space-y-2">{tiers.map((tier, index) => <div key={index} className="flex gap-2"><input type="number" min="1" required value={tier.min_quantity} onChange={(e) => setTiers(tiers.map((item, i) => i === index ? { ...item, min_quantity: Number(e.target.value) } : item))} className="w-1/2 border rounded-lg px-3 py-2" placeholder="عدد القطع" /><input type="number" min="0" step="0.01" required value={tier.bundle_price} onChange={(e) => setTiers(tiers.map((item, i) => i === index ? { ...item, bundle_price: Number(e.target.value) } : item))} className="w-1/2 border rounded-lg px-3 py-2" placeholder="سعر الباقة" /></div>)}</div>
              <div className="flex justify-between text-xs text-gray-500 mt-1"><span>من عدد قطع</span><span>إجمالي سعر الباقة</span></div>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> العرض فعال</label>
            <button disabled={loading} className="w-full rounded-lg bg-red-600 py-3 font-bold text-white shadow-md shadow-red-200 transition hover:bg-red-700 disabled:bg-gray-400">
              {loading ? "جاري الحفظ..." : editingId ? "حفظ تعديلات العرض" : "حفظ العرض"}
            </button>
          </form>
          <section className="lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">العروض الحالية ({promotions.length})</h2>
            </div>
            {promotions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500 shadow-sm">لا توجد عروض مضافة.</div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {promotions.map((promotion) => (
                  <div key={promotion.id} className="relative overflow-hidden rounded-2xl border border-red-100 bg-white p-6 shadow-[0_14px_35px_rgba(220,38,38,0.12)] transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(220,38,38,0.18)]">
                    <div className="absolute inset-x-0 top-0 h-1 bg-red-600" />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-extrabold text-red-700">{promotion.name}</h3>
                        <p className="mt-1 text-sm text-gray-600">التصنيف: {promotion.category?.name}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${promotion.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {promotion.active ? "فعال" : "متوقف"}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                      {promotion.tiers.map((tier: any) => (
                        <div key={tier.id} className="flex justify-between rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                          <span>{tier.min_quantity} قطع</span>
                          <span>{Number(tier.bundle_price).toLocaleString()} ج.م</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex gap-3 border-t border-gray-100 pt-4">
                      <button onClick={() => editPromotion(promotion)} className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-bold text-white transition hover:bg-gray-700">تعديل</button>
                      <button onClick={() => deletePromotion(promotion.id)} className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
