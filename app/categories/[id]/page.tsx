import { getCategoryData } from "@/lib/get-category-data";
import CategoryClient from "@/app/components/CategoryClient";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. جلب البيانات من السيرفر مباشرة
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