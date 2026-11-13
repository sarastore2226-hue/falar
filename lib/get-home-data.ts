import { PrismaClient } from "@prisma/client";
import { normalizePublicImageUrl } from "./utils";

const prisma = new PrismaClient();
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

interface HomeVariant {
  id: string;
  color: string;
  imageUrl: string;
  material: string;
  itemCode: string;
  cur_qty: number;
  totalColorQuantity: number;
  sizes: string[];
}

interface HomeGroupedProduct {
  modelId: string;
  master_code: string;
  price: number;
  category: string;
  group_name: string;
  kind_name: string;
  description: string;
  item_name: string;
  cur_qty: number;
  variants: HomeVariant[];
}

export async function getHomeData() {
  try {
    // 1. جلب المنتجات المتاحة من جدول Product الأساسي
    const productsRaw = await prisma.product.findMany({
      where: {
        OR: [
          { status: "OPEN" },
          { currentStock: { gt: 0 } },
        ],
      },
      orderBy: { id: "desc" },
      take: 250,
    });

    const categories = await prisma.categories.findMany({
      orderBy: { id: "asc" },
    });

    // 2. تجميع النسخ والألوان لكل موديل باستخدام Map بأنواع دقيقة
    const groupedByMasterCode = new Map<string, HomeGroupedProduct>();

    productsRaw.forEach((row) => {
      const modelId = row.modelNo.trim();
      const color = row.color.trim() || "افتراضي";
      const curQty = Number(row.currentStock) || 0;
      const compositeKey = row.material || `${modelId}${color}`;

      if (!groupedByMasterCode.has(modelId)) {
        groupedByMasterCode.set(modelId, {
          modelId,
          master_code: modelId,
          price: row.price || 0,
          category: row.group_name || row.kind_name || row.material || "عام",
          group_name: row.group_name || "",
          kind_name: row.kind_name || "",
          description: row.description || `موديل ${modelId}`,
          item_name: row.description || `موديل ${modelId}`,
          cur_qty: 0,
          variants: [],
        });
      }

      const item = groupedByMasterCode.get(modelId)!;
      const variant = item.variants.find((v) => v.color === color);

      const fallbackUrl = `${R2_PUBLIC_URL}/${modelId}-${color}.webp`;
      const imageUrl = row.image
        ? normalizePublicImageUrl(row.image) || fallbackUrl
        : fallbackUrl;

      if (!variant) {
        item.variants.push({
          id: row.id,
          color,
          imageUrl,
          material: compositeKey,
          itemCode: compositeKey,
          cur_qty: curQty,
          totalColorQuantity: curQty,
          sizes: ["ONE SIZE"],
        });
      } else {
        variant.cur_qty += curQty;
        variant.totalColorQuantity += curQty;
      }

      item.cur_qty += curQty;
    });

    const finalProducts = Array.from(groupedByMasterCode.values());

    const normalizedCategories = categories.map((category) => ({
      ...category,
      image: normalizePublicImageUrl(category.image),
    }));

    return JSON.parse(
      JSON.stringify({
        products: finalProducts,
        categories: normalizedCategories,
      })
    );
  } catch (error) {
    console.error("Home Data Error:", error);
    return { products: [], categories: [] };
  }
}