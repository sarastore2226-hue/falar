import { PrismaClient } from "@prisma/client";
import { normalizePublicImageUrl } from "./utils";

const prisma = new PrismaClient();

export async function getHomeData() {
  try {
    // 1. جلب المنتجات (عدد محدود للسرعة)
    const productsRaw = await prisma.products.findMany({
      where: {
        cur_qty: { gt: 0 },
        stor_id: 0,
      },
      orderBy: { unique_id: "desc" }, // الأحدث
      take: 200, // نجلب 200 لتكفي الصفحة الرئيسية
    });

    const categories = await prisma.categories.findMany();

    // 2. تجميع المنتجات (نفس منطق الـ API)
    const groupedByMasterCode: { [key: string]: any } = {};

    productsRaw.forEach((row) => {
      const masterCode = row.master_code;
      if (!masterCode) return;

      const color = row.color || "افتراضي";
      const size = row.size || null;
      const curQty = Number(row.cur_qty) || 0;
      const itemCode = row.item_code || "";

      if (!groupedByMasterCode[masterCode]) {
        groupedByMasterCode[masterCode] = {
          modelId: masterCode,
          master_code: masterCode,
          price: row.out_price || 0,
          category: row.group_name || row.kind_name || "",
          description: row.item_name || row.kind_name || "منتج بدون وصف",
          group_name: row.group_name || "",
          kind_name: row.kind_name || "",
          item_name: row.item_name || "",
          item_code: "",
          cur_qty: 0,
          variants: [],
        };
      }

      let variant = groupedByMasterCode[masterCode].variants.find(
        (v: any) => v.color === color
      );

      if (!variant) {
        let imageUrl = "https://via.placeholder.com/500x700/EFEFEF/666666?text=No+Image";
        if (row.images && row.images.length > 50) {
             imageUrl = row.images;
        }

        variant = {
          id: row.unique_id,
          color: color,
          imageUrl: imageUrl,
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