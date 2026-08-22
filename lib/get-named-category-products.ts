import { prisma } from "./prisma";

type CategoryField = "group_name" | "item_name";

type ProductRow = {
  unique_id: string;
  master_code: string | null;
  item_code: string | null;
  item_name: string | null;
  color: string | null;
  size: string | null;
  cur_qty: unknown;
  out_price: unknown;
  group_name: string | null;
  kind_name: string | null;
  images: string | null;
};

function getImageUrl(images: string | null) {
  if (!images) return "https://via.placeholder.com/500x700/EFEFEF/666666?text=No+Image";

  const image = images.trim();
  if (!image || image.toLowerCase() === "null") {
    return "https://via.placeholder.com/500x700/EFEFEF/666666?text=No+Image";
  }

  if (image.startsWith("data:image") || image.startsWith("http") || image.startsWith("/")) {
    return image;
  }

  return image.length > 50 ? `data:image/jpeg;base64,${image}` : image;
}

export async function getNamedCategoryProducts(
  name: string,
  field: CategoryField
) {
  const categoryName = decodeURIComponent(name).trim();
  if (!categoryName) return [];

  const products = await prisma.products.findMany({
    where: {
      cur_qty: { gt: 0 },
      stor_id: 0,
      [field]: { equals: categoryName, mode: "insensitive" },
    },
    select: {
      unique_id: true,
      master_code: true,
      item_code: true,
      item_name: true,
      color: true,
      size: true,
      cur_qty: true,
      out_price: true,
      group_name: true,
      kind_name: true,
      images: true,
    },
    orderBy: { unique_id: "desc" },
  }) as ProductRow[];

  const grouped = new Map<string, any>();

  for (const row of products) {
    if (!row.master_code) continue;

    let product = grouped.get(row.master_code);
    if (!product) {
      product = {
        modelId: row.master_code,
        master_code: row.master_code,
        price: Number(row.out_price) || 0,
        category: row.group_name || row.kind_name || "",
        description: row.item_name || row.kind_name || "منتج بدون وصف",
        group_name: row.group_name || "",
        kind_name: row.kind_name || "",
        item_name: row.item_name || "",
        cur_qty: 0,
        variants: [],
      };
      grouped.set(row.master_code, product);
    }

    const quantity = Number(row.cur_qty) || 0;
    const color = row.color || "افتراضي";
    let variant = product.variants.find((item: any) => item.color === color);

    if (!variant) {
      variant = {
        id: row.unique_id,
        color,
        imageUrl: getImageUrl(row.images),
        sizes: [],
        cur_qty: 0,
        sizeQuantities: {},
      };
      product.variants.push(variant);
    }

    variant.cur_qty += quantity;
    product.cur_qty += quantity;

    if (row.size && !variant.sizes.includes(row.size)) {
      variant.sizes.push(row.size);
    }
  }

  return Array.from(grouped.values());
}
