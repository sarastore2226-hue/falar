import { prisma } from "./prisma";
import { normalizePublicImageUrl } from "./utils";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

interface HomeVariant {
  id: string;
  color: string;
  imageUrl: string;
  itemCode: string;
  material: string;
  sizes: string[];
  cur_qty: number;
  sizeQuantities: Record<string, number>;
}

interface HomeGroupedProduct {
  modelId: string;
  master_code: string;
  price: number;
  size: string;
  category: string;
  description: string;
  group_name: string;
  kind_name: string;
  item_name: string;
  item_code: string;
  cur_qty: number;
  variants: HomeVariant[];
}

export async function getHomeData() {
  try {
    const productsRaw = await prisma.product.findMany({
      where: {
        OR: [{ status: "OPEN" }, { currentStock: { gt: 0 } }],
      },
      orderBy: { id: "desc" },
      take: 200,
    });

    const categories = await prisma.categories.findMany();

    const groupedByMasterCode: Record<string, HomeGroupedProduct> = {};

    productsRaw.forEach((row) => {
      const masterCode = row.modelNo;
      if (!masterCode) return;

      const color = row.color || "افتراضي";
      const rowSize = (row.size || "").trim();
      const sizeLabel = rowSize || "ONE SIZE";
      const curQty = Number(row.currentStock) || 0;
      const itemCode = `${row.modelNo}-${color}`;

      if (!groupedByMasterCode[masterCode]) {
        groupedByMasterCode[masterCode] = {
          modelId: masterCode,
          master_code: masterCode,
          price: row.price || 0,
          size: rowSize,
          category: row.group_name || row.kind_name || row.material || "",
          description: row.description || row.kind_name || "منتج بدون وصف",
          group_name: row.group_name || "",
          kind_name: row.kind_name || "",
          item_name: row.description || "",
          item_code: itemCode,
          cur_qty: 0,
          variants: [],
        };
      } else if (!groupedByMasterCode[masterCode].size && rowSize) {
        groupedByMasterCode[masterCode].size = rowSize;
      }

      let variant = groupedByMasterCode[masterCode].variants.find(
        (v) => v.color === color
      );

      if (!variant) {
        let imageUrl =
          "https://via.placeholder.com/500x700/EFEFEF/666666?text=No+Image";
        if (row.image && row.image.length > 10) {
          imageUrl = row.image;
        } else {
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

      variant.sizes.push(sizeLabel);
      variant.sizeQuantities[sizeLabel] =
        (variant.sizeQuantities[sizeLabel] || 0) + curQty;
    });

    const finalProducts = Object.values(groupedByMasterCode).map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        imageUrl: normalizePublicImageUrl(variant.imageUrl),
      })),
    }));

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