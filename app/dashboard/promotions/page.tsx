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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category_id: Number(form.category_id), tiers }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setForm({ name: "", category_id: "", active: true });
      setTiers([{ ...emptyTier }]);
      await loadData();
    } catch (error: any) {
      alert(error.message || "فشل حفظ العرض");
    } finally {
      setLoading(false);
    }
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
          <form onSubmit={submit} className="bg-white rounded-xl border p-6 space-y-5 h-fit">
            <h2 className="text-xl font-bold">إضافة عرض</h2>
            <label className="block">اسم العرض<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2" placeholder="عرض الشورت البناتي" /></label>
            <label className="block">التصنيف<select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2"><option value="">اختر التصنيف</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <div>
              <div className="flex justify-between items-center mb-2"><span className="font-medium">شرائح الأسعار</span><button type="button" onClick={() => setTiers([...tiers, { min_quantity: 1, bundle_price: 0 }])} className="text-blue-600">+ شريحة</button></div>
              <div className="space-y-2">{tiers.map((tier, index) => <div key={index} className="flex gap-2"><input type="number" min="1" required value={tier.min_quantity} onChange={(e) => setTiers(tiers.map((item, i) => i === index ? { ...item, min_quantity: Number(e.target.value) } : item))} className="w-1/2 border rounded-lg px-3 py-2" placeholder="عدد القطع" /><input type="number" min="0" step="0.01" required value={tier.bundle_price} onChange={(e) => setTiers(tiers.map((item, i) => i === index ? { ...item, bundle_price: Number(e.target.value) } : item))} className="w-1/2 border rounded-lg px-3 py-2" placeholder="سعر الباقة" /></div>)}</div>
              <div className="flex justify-between text-xs text-gray-500 mt-1"><span>من عدد قطع</span><span>إجمالي سعر الباقة</span></div>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> العرض فعال</label>
            <button disabled={loading} className="w-full bg-blue-600 text-white rounded-lg py-3 font-bold disabled:bg-gray-400">{loading ? "جاري الحفظ..." : "حفظ العرض"}</button>
          </form>
          <section className="lg:col-span-2 bg-white rounded-xl border overflow-hidden">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">العروض الحالية ({promotions.length})</h2></div>
            {promotions.length === 0 ? <p className="p-6 text-gray-500">لا توجد عروض مضافة.</p> : <div className="divide-y">{promotions.map((promotion) => <div key={promotion.id} className="p-6 flex justify-between gap-4"><div><h3 className="font-bold">{promotion.name}</h3><p className="text-sm text-gray-600">التصنيف: {promotion.category?.name} {promotion.active ? "• فعال" : "• متوقف"}</p><div className="flex flex-wrap gap-2 mt-3">{promotion.tiers.map((tier: any) => <span key={tier.id} className="bg-blue-50 text-blue-800 px-3 py-1 rounded-lg text-sm">{tier.min_quantity}+ قطع: {Number(tier.bundle_price).toLocaleString()} ج.م</span>)}</div></div><button onClick={() => deletePromotion(promotion.id)} className="text-red-600 h-fit">حذف</button></div>)}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
