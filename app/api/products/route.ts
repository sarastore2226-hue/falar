import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePublicImageUrl } from "@/lib/utils";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

interface ProductVariantItem {
  id: string;
  color: string;
  imageUrl: string;
  cur_qty: number;
  price: number;
  material: string;
  itemCode: string;
  sizes: string[];
}

interface GroupedProduct {
  modelId: string;
  master_code: string;
  price: number;
  category: string;
  group_name: string;
  kind_name: string;
  description: string;
  cur_qty: number;
  variants: ProductVariantItem[];
}

interface BulkProductRow {
  master_code?: string;
  modelNo?: string;
  color?: string;
  material?: string;
  item_name?: string;
  description?: string;
  out_price?: number | string;
  price?: number | string;
  cur_qty?: number | string;
  stockQty?: number | string;
  group_name?: string;
  kind_name?: string;
  images?: string;
  image?: string;
}

// 1️⃣ دالة GET
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoryParam = searchParams.get("category");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const employeeView = searchParams.get("employee") === "true";
    const isExport = searchParams.get("export") === "true";

    const limit = limitParam ? parseInt(limitParam, 10) : 10000;
    const page = pageParam ? parseInt(pageParam, 10) : 1;

    const andConditions: Prisma.ProductWhereInput[] = [];

    // إظهار المتاح فقط للعميل العادي
    if (!employeeView && !isExport) {
      andConditions.push({
        OR: [
          { status: "OPEN" },
          { currentStock: { gt: 0 } },
        ],
      });
    }

    // البحث النصي في الموديل، اللون، الكي المميز material، الوصف، والأقسام
    if (search) {
      andConditions.push({
        OR: [
          { modelNo: { contains: search, mode: "insensitive" } },
          { color: { contains: search, mode: "insensitive" } },
          { material: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { group_name: { contains: search, mode: "insensitive" } },
          { kind_name: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // فحص الفئات بالاسم أو الرقم
    let categoryName = categoryParam;
    if (categoryParam && !isNaN(parseInt(categoryParam, 10))) {
      const cat = await prisma.categories.findUnique({
        where: { id: parseInt(categoryParam, 10) },
      });
      if (cat) categoryName = cat.name;
    }

    if (categoryName) {
      andConditions.push({
        OR: [
          { group_name: { contains: categoryName, mode: "insensitive" } },
          { kind_name: { contains: categoryName, mode: "insensitive" } },
          { material: { contains: categoryName, mode: "insensitive" } },
          { description: { contains: categoryName, mode: "insensitive" } },
        ],
      });
    }

    const whereConditions: Prisma.ProductWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    if (isExport) {
      const rawExport = await prisma.product.findMany({
        where: whereConditions,
        orderBy: { modelNo: "asc" },
      });

      const exportData = rawExport.map((p) => ({
        master_code: p.modelNo,
        item_code: p.material || `${p.modelNo}${p.color}`,
        item_name: p.description || `موديل ${p.modelNo}`,
        color: p.color,
        size: "ONE SIZE",
        out_price: p.price,
        cur_qty: p.currentStock,
        group_name: p.group_name || "",
        kind_name: p.kind_name || "",
        material: p.material || `${p.modelNo}${p.color}`,
        images: p.image || "",
      }));

      return NextResponse.json({ success: true, data: exportData });
    }

    const rawProducts = await prisma.product.findMany({
      where: whereConditions,
      orderBy: { id: "desc" },
    });

    const groupedMap = new Map<string, GroupedProduct>();

    for (const p of rawProducts) {
      const modelId = p.modelNo.trim();
      const colorName = p.color.trim();
      const compositeKey = p.material || `${modelId}${colorName}`;

      const fallbackImage = `${R2_PUBLIC_URL}/${modelId}-${colorName}.webp`;
      const imageUrl = p.image
        ? normalizePublicImageUrl(p.image) || fallbackImage
        : fallbackImage;

      if (!groupedMap.has(modelId)) {
        groupedMap.set(modelId, {
          modelId,
          master_code: modelId,
          price: p.price,
          category: p.group_name || p.kind_name || p.material || "عام",
          group_name: p.group_name || "",
          kind_name: p.kind_name || "",
          description: p.description || `موديل ${modelId}`,
          cur_qty: 0,
          variants: [],
        });
      }

      const item = groupedMap.get(modelId)!;
      item.cur_qty += p.currentStock;

      item.variants.push({
        id: p.id,
        color: colorName,
        imageUrl,
        cur_qty: p.currentStock,
        price: p.price,
        material: compositeKey,
        itemCode: compositeKey,
        sizes: ["ONE SIZE"],
      });
    }

    const allGrouped = Array.from(groupedMap.values());
    const totalProducts = allGrouped.length;
    let paginated = allGrouped;

    if (limitParam) {
      const skip = (page - 1) * limit;
      paginated = allGrouped.slice(skip, skip + limit);
    }

    return NextResponse.json({
      success: true,
      products: paginated,
      pagination: {
        page,
        limit: limitParam ? limit : totalProducts,
        totalProducts,
        totalPages: limitParam ? Math.ceil(totalProducts / limit) || 1 : 1,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

// 2️⃣ دالة POST
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BulkProductRow | BulkProductRow[];

    if (Array.isArray(body)) {
      let count = 0;
      for (const item of body) {
        const modelNo = String(item.master_code || item.modelNo || "").trim();
        const color = String(item.color || "افتراضي").trim();
        if (!modelNo) continue;

        const finalMaterial = (item.material && String(item.material).trim() !== "")
          ? String(item.material).trim()
          : `${modelNo}${color}`.trim();

        await prisma.product.upsert({
          where: {
            modelNo_color: {
              modelNo,
              color,
            },
          },
          update: {
            description: item.item_name || item.description,
            price: parseFloat(String(item.out_price || item.price || 0)) || 0,
            currentStock: parseInt(String(item.cur_qty || item.stockQty || 0), 10) || 0,
            stockQty: parseInt(String(item.cur_qty || item.stockQty || 0), 10) || 0,
            group_name: item.group_name || "",
            kind_name: item.kind_name || "",
            material: finalMaterial,
            image: item.images || item.image || "",
          },
          create: {
            modelNo,
            color,
            description: item.item_name || item.description || `موديل ${modelNo}`,
            price: parseFloat(String(item.out_price || item.price || 0)) || 0,
            currentStock: parseInt(String(item.cur_qty || item.stockQty || 0), 10) || 0,
            stockQty: parseInt(String(item.cur_qty || item.stockQty || 0), 10) || 0,
            group_name: item.group_name || "",
            kind_name: item.kind_name || "",
            material: finalMaterial,
            image: item.images || item.image || "",
          },
        });
        count++;
      }
      return NextResponse.json({
        success: true,
        count,
        message: `تم تحديث ${count} صنف موحد بنجاح`,
      });
    }

    const singleItem = body;
    const modelNo = String(singleItem.master_code || singleItem.modelNo || "").trim();
    const color = String(singleItem.color || "افتراضي").trim();

    if (!modelNo) {
      return NextResponse.json(
        { success: false, error: "كود الموديل مطلوب" },
        { status: 400 }
      );
    }

    const finalMaterial = (singleItem.material && String(singleItem.material).trim() !== "")
      ? String(singleItem.material).trim()
      : `${modelNo}${color}`.trim();

    const createdProduct = await prisma.product.upsert({
      where: {
        modelNo_color: {
          modelNo,
          color,
        },
      },
      update: {
        description: singleItem.item_name || singleItem.description,
        price: parseFloat(String(singleItem.out_price || singleItem.price || 0)) || 0,
        currentStock: parseInt(String(singleItem.cur_qty || singleItem.stockQty || 0), 10) || 0,
        stockQty: parseInt(String(singleItem.cur_qty || singleItem.stockQty || 0), 10) || 0,
        group_name: singleItem.group_name || "",
        kind_name: singleItem.kind_name || "",
        material: finalMaterial,
        image: singleItem.images || singleItem.image || "",
      },
      create: {
        modelNo,
        color,
        description: singleItem.item_name || singleItem.description || `موديل ${modelNo}`,
        price: parseFloat(String(singleItem.out_price || singleItem.price || 0)) || 0,
        currentStock: parseInt(String(singleItem.cur_qty || singleItem.stockQty || 0), 10) || 0,
        stockQty: parseInt(String(singleItem.cur_qty || singleItem.stockQty || 0), 10) || 0,
        group_name: singleItem.group_name || "",
        kind_name: singleItem.kind_name || "",
        material: finalMaterial,
        image: singleItem.images || singleItem.image || "",
      },
    });

    return NextResponse.json({ success: true, product: createdProduct });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}