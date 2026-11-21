import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePublicImageUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

interface ProductVariantResponse {
  id: string;
  color: string;
  imageUrl: string;
  hasImage: boolean;
  cur_qty: number;
  price: number;
  itemCode: string;
  item_code: string;
  sizes: string[];
  size: string;
  material: string | null;
}

interface GroupedProductResponse {
  modelId: string;
  master_code: string;
  price: number;
  size: string;
  category: string;
  group_name: string;
  kind_name: string;
  description: string;
  cur_qty: number;
  variants: ProductVariantResponse[];
}

interface ProductPayloadInput {
  master_code?: string;
  modelNo?: string;
  color?: string;
  size?: string;
  item_name?: string;
  description?: string;
  out_price?: string | number;
  price?: string | number;
  cur_qty?: string | number;
  stockQty?: string | number;
  group_name?: string;
  kind_name?: string;
  material?: string;
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

    if (!employeeView && !isExport) {
      andConditions.push({
        OR: [{ status: "OPEN" }, { currentStock: { gt: 0 } }],
      });
    }

    if (search) {
      andConditions.push({
        OR: [
          { modelNo: { contains: search, mode: "insensitive" } },
          { color: { contains: search, mode: "insensitive" } },
          { size: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { material: { contains: search, mode: "insensitive" } },
          { group_name: { contains: search, mode: "insensitive" } },
          { kind_name: { contains: search, mode: "insensitive" } },
        ],
      });
    }

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

    const whereConditions: Prisma.ProductWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    if (isExport) {
      const rawExport = await prisma.product.findMany({
        where: whereConditions,
        orderBy: { modelNo: "asc" },
      });

      const exportData = rawExport.map((p) => ({
        master_code: p.modelNo,
        item_code: `${p.modelNo}-${p.color}`,
        item_name: p.description || `موديل ${p.modelNo}`,
        color: p.color,
        size: p.size || "",
        out_price: p.price,
        cur_qty: p.currentStock,
        group_name: p.group_name || "",
        kind_name: p.kind_name || "",
        material: p.material || "",
        images: p.image || "",
      }));

      return NextResponse.json({ success: true, data: exportData });
    }

    const rawProducts = await prisma.product.findMany({
      where: whereConditions,
      orderBy: { id: "desc" },
    });

    const groupedMap = new Map<string, GroupedProductResponse>();

    for (const p of rawProducts) {
      const modelId = p.modelNo.trim();
      const colorName = p.color.trim();
      const generalSize = (p.size || "").trim();

      const hasRealImage = Boolean(p.image && p.image.trim() !== "");
      const fallbackImage = `${R2_PUBLIC_URL}/${modelId}-${colorName}.webp`;
      const imageUrl =
        (hasRealImage ? normalizePublicImageUrl(p.image) : null) ||
        fallbackImage;

      let item = groupedMap.get(modelId);
      if (!item) {
        item = {
          modelId: modelId,
          master_code: modelId,
          price: p.price,
          size: generalSize,
          category: p.group_name || p.kind_name || p.material || "عام",
          group_name: p.group_name || "",
          kind_name: p.kind_name || "",
          description: p.description || `موديل ${modelId}`,
          cur_qty: 0,
          variants: [],
        };
        groupedMap.set(modelId, item);
      } else if (!item.size && generalSize) {
        item.size = generalSize;
      }

      item.cur_qty += p.currentStock;

      item.variants.push({
        id: p.id,
        color: colorName,
        imageUrl: imageUrl,
        hasImage: hasRealImage,
        cur_qty: p.currentStock,
        price: p.price,
        itemCode: `${modelId}-${colorName}`,
        item_code: `${modelId}-${colorName}`,
        sizes: [generalSize || "ONE SIZE"],
        size: generalSize,
        material: p.material,
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
    const message =
      error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// 2️⃣ دالة POST
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as
      | ProductPayloadInput
      | ProductPayloadInput[];

    if (Array.isArray(body)) {
      let count = 0;
      for (const item of body) {
        const modelNo = String(item.master_code || item.modelNo || "").trim();
        const color = String(item.color || "افتراضي").trim();
        if (!modelNo) continue;

        const price = parseFloat(String(item.out_price ?? item.price ?? 0)) || 0;
        const qty = parseInt(String(item.cur_qty ?? item.stockQty ?? 0), 10) || 0;
        const sizeVal = String(item.size || "").trim();

        await prisma.product.upsert({
          where: {
            modelNo_color: {
              modelNo: modelNo,
              color: color,
            },
          },
          update: {
            description: item.item_name || item.description,
            size: sizeVal || undefined,
            price: price,
            currentStock: qty,
            stockQty: qty,
            group_name: item.group_name || "",
            kind_name: item.kind_name || "",
            material: item.material || "",
            image: item.images || item.image || "",
          },
          create: {
            modelNo: modelNo,
            color: color,
            size: sizeVal || null,
            description: item.item_name || item.description || `موديل ${modelNo}`,
            price: price,
            currentStock: qty,
            stockQty: qty,
            group_name: item.group_name || "",
            kind_name: item.kind_name || "",
            material: item.material || "",
            image: item.images || item.image || "",
          },
        });
        count++;
      }
      return NextResponse.json({
        success: true,
        count,
        message: `تم رفع وتحديث ${count} صنف بنجاح`,
      });
    }

    const modelNo = String(body.master_code || body.modelNo || "").trim();
    const color = String(body.color || "افتراضي").trim();

    if (!modelNo) {
      return NextResponse.json(
        { success: false, error: "كود الموديل مطلوب" },
        { status: 400 }
      );
    }

    const price = parseFloat(String(body.out_price ?? body.price ?? 0)) || 0;
    const qty = parseInt(String(body.cur_qty ?? body.stockQty ?? 0), 10) || 0;
    const sizeVal = String(body.size || "").trim();

    const createdProduct = await prisma.product.upsert({
      where: {
        modelNo_color: {
          modelNo: modelNo,
          color: color,
        },
      },
      update: {
        description: body.item_name || body.description,
        size: sizeVal || undefined,
        price: price,
        currentStock: qty,
        stockQty: qty,
        group_name: body.group_name || "",
        kind_name: body.kind_name || "",
        material: body.material || "",
        image: body.images || body.image || "",
      },
      create: {
        modelNo: modelNo,
        color: color,
        size: sizeVal || null,
        description: body.item_name || body.description || `موديل ${modelNo}`,
        price: price,
        currentStock: qty,
        stockQty: qty,
        group_name: body.group_name || "",
        kind_name: body.kind_name || "",
        material: body.material || "",
        image: body.images || body.image || "",
      },
    });

    return NextResponse.json({ success: true, product: createdProduct });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}