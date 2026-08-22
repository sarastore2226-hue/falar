import Link from "next/link";
import { getNamedCategoryProducts } from "@/lib/get-named-category-products";

export const revalidate = 60;

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const categoryName = decodeURIComponent(name);
  const products = await getNamedCategoryProducts(categoryName, "group_name");

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">قسم: {categoryName}</h1>
      {products.length === 0 ? (
        <p>لا توجد منتجات في هذا القسم حالياً.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const firstVariant = product.variants[0];
            if (!firstVariant) return null;
            return (
              <Link
                href={`/product/${product.modelId}`}
                key={product.modelId}
                className="group block border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="relative w-full aspect-square bg-gray-200">
                  <img
                    src={firstVariant.imageUrl}
                    alt={product.modelId}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-4 bg-white">
                  <h3 className="font-semibold text-lg text-gray-800">
                    كود: {product.modelId}
                  </h3>
                  <p className="text-pink-500 font-bold mt-2">
                    {product.price} جنيه
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
