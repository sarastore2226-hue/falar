import { getCategoryData } from "@/lib/get-category-data";
import CategoryClient from "@/app/components/CategoryClient";

export const revalidate = 60; // تحديث البيانات كل 60 ثانية
export const dynamic = "force-static";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. جلب البيانات من السيرفر مباشرة (بسرعة البرق)
  const data = await getCategoryData(id);

  // 2. تمرير البيانات للمكون العميل
  return (
    <CategoryClient
      initialProducts={data.products}
      categories={data.categories}
      currentCategory={data.currentCategory}
      subCategories={data.subCategories}
    />
  );
}
