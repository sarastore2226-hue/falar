import { PrismaClient } from "@prisma/client";
import { normalizePublicImageUrl } from "./utils";

const prisma = new PrismaClient();
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

interface CategoryVariant {
  id: string;
  color: string;
  imageUrl: string;
  material: string;
  itemCode: string;
  cur_qty: number;
  totalColorQuantity: number;
  sizes: string[];
}

interface CategoryGroupedProduct {
  modelId: string;
  master_code: string;
  price: number;
  category: string;
  group_name: string;
  kind_name: string;
  description: string;
  item_name: string;
  cur_qty: number;
  variants: CategoryVariant[];
}

export async function getCategoryData(categoryId: string) {
  try {
    const id = parseInt(categoryId, 10);

    // 1. جلب التصنيفات لتحديد التصنيف الحالي والفروع
    const categories = await prisma.categories.findMany({
      select: {
        id: true,
        name: true,
        kind: true,
        image: true,
        sub: true,
      },
    });

    const currentCategory = categories.find((cat) => cat.id === id);

    if (!currentCategory) {
      return {
        products: [],
        categories: [],
        currentCategory: null,
        subCategories: [],
      };
    }

    const normalizedCategories = categories.map((category) => ({
      ...category,
      image: normalizePublicImageUrl(category.image),
    }));

    const normalizedCurrentCategory = normalizedCategories.find(
      (category) => category.id === id
    );

    const subCategories = normalizedCategories.filter(
      (cat) => cat.sub === currentCategory.name && cat.image
    );

    // 2. البحث في جدول Product الموحد بناءً على اسم التصنيف
    const productsRaw = await prisma.product.findMany({
      where: {
        OR: [
          { status: "OPEN" },
          { currentStock: { gt: 0 } },
        ],
        AND: [
          {
            OR: [
              { group_name: { contains: currentCategory.name, mode: "insensitive" } },
              { kind_name: { contains: currentCategory.name, mode: "insensitive" } },
              { description: { contains: currentCategory.name, mode: "insensitive" } },
              { material: { contains: currentCategory.name, mode: "insensitive" } },
            ],
          },
        ],
      },
      orderBy: { id: "desc" },
    });

    // 3. تجميع الألوان التابعة لكل موديل
    const groupedByMasterCode = new Map<string, CategoryGroupedProduct>();

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
          category: row.group_name || row.kind_name || row.material || currentCategory.name,
          group_name: row.group_name || "",
          kind_name: row.kind_name || "",
          description: row.description || `موديل ${modelId}`,
          item_name: row.description || `موديل ${modelId}`,
          cur_qty: 0,
          variants: [],
        });
      }

      const item = groupedByMasterCode.get(modelId)!;
      let variant = item.variants.find((v) => v.color === color);

      // استخدام const وتجنب let لإرضاء prefer-const
      const fallbackUrl = `${R2_PUBLIC_URL}/${modelId}-${color}.webp`;
      const imageUrl = row.image
        ? normalizePublicImageUrl(row.image) || fallbackUrl
        : fallbackUrl;

      if (!variant) {
        variant = {
          id: row.id,
          color,
          imageUrl,
          material: compositeKey,
          itemCode: compositeKey,
          cur_qty: curQty,
          totalColorQuantity: curQty,
          sizes: ["ONE SIZE"],
        };
        item.variants.push(variant);
      } else {
        variant.cur_qty += curQty;
        variant.totalColorQuantity += curQty;
      }

      item.cur_qty += curQty;
    });

    const finalProducts = Array.from(groupedByMasterCode.values());

    return JSON.parse(
      JSON.stringify({
        products: finalProducts,
        categories: normalizedCategories,
        currentCategory: normalizedCurrentCategory,
        subCategories,
      })
    );
  } catch (error) {
    console.error("Category Data Error:", error);
    return {
      products: [],
      categories: [],
      currentCategory: null,
      subCategories: [],
    };
  }
}