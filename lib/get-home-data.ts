import { PrismaClient } from "@prisma/client";
import { normalizePublicImageUrl } from "./utils";

const prisma = new PrismaClient();

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

export async function getHomeData() {
  try {
    // 1. جلب المنتجات من جدول Product المعتمد (المعرض)
    const productsRaw = await prisma.product.findMany({
      where: {
        OR: [
          { status: "OPEN" },
          { currentStock: { gt: 0 } },
        ],
      },
      orderBy: { id: "desc" }, // الأحدث
      take: 200, // نجلب 200 لتكفي الصفحة الرئيسية
    });

    const categories = await prisma.categories.findMany();

    // 2. تجميع المنتجات (نفس منطق الـ API الأصلي بالكامل)
    const groupedByMasterCode: { [key: string]: any } = {};

    productsRaw.forEach((row) => {
      const masterCode = row.modelNo;
      if (!masterCode) return;

      const color = row.color || "افتراضي";
      const size = "ONE SIZE"; // المقاس الافتراضي للجملة
      const curQty = Number(row.currentStock) || 0;
      const itemCode = `${row.modelNo}-${color}`;

      if (!groupedByMasterCode[masterCode]) {
        groupedByMasterCode[masterCode] = {
          modelId: masterCode,
          master_code: masterCode,
          price: row.price || 0,
          category: row.group_name || row.kind_name || row.material || "",
          description: row.description || row.kind_name || "منتج بدون وصف",
          group_name: row.group_name || "",
          kind_name: row.kind_name || "",
          item_name: row.description || "",
          item_code: itemCode,
          cur_qty: 0,
          variants: [],
        };
      }

      let variant = groupedByMasterCode[masterCode].variants.find(
        (v: any) => v.color === color
      );

      if (!variant) {
        let imageUrl = "https://via.placeholder.com/500x700/EFEFEF/666666?text=No+Image";
        if (row.image && row.image.length > 10) {
          imageUrl = row.image;
        } else {
          // استدعاء الصورة من R2 تلقائياً باسم (كود الموديل - اللون)
          imageUrl = `${R2_PUBLIC_URL}/${masterCode}-${color}.webp`;
        }

        variant = {
          id: row.id,
          color: color,
          imageUrl: imageUrl,
          itemCode: itemCode,
          material: row.material || "",
          sizes: [],
          cur_qty: curQty,
          sizeQuantities: {},
        };
        groupedByMasterCode[masterCode].variants.push(variant);
      } else {
        variant.cur_qty += curQty;
      }

      groupedByMasterCode[masterCode].cur_qty += curQty;

      if (size) {
        variant.sizes.push(size);
        variant.sizeQuantities = variant.sizeQuantities || {};
        variant.sizeQuantities[size] = (variant.sizeQuantities[size] || 0) + curQty;
      }
    });

    const finalProducts = Object.values(groupedByMasterCode).map((product: any) => ({
      ...product,
      variants: product.variants.map((variant: any) => ({
        ...variant,
        imageUrl: normalizePublicImageUrl(variant.imageUrl),
      })),
    }));

    const normalizedCategories = categories.map((category) => ({
      ...category,
      image: normalizePublicImageUrl(category.image),
    }));

    // تسلسل البيانات لتجنب مشاكل التواريخ في Next.js
    return JSON.parse(JSON.stringify({ 
        products: finalProducts, 
        categories: normalizedCategories
    }));

  } catch (error) {
    console.error("Home Data Error:", error);
    return { products: [], categories: [] };
  }
}