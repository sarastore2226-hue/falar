import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePublicImageUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

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

    const limit = limitParam ? parseInt(limitParam) : 10000;
    const page = pageParam ? parseInt(pageParam) : 1;

    const andConditions: any[] = [];

    // إذا لم يكن موظفاً ولم يكن تصديراً، نظهر المتاح فقط
    if (!employeeView && !isExport) {
      andConditions.push({
        OR: [
          { status: "OPEN" },
          { currentStock: { gt: 0 } }
        ]
      });
    }

    // البحث النصي في الكود، اللون، الوصف، الجروب، والنوع
    if (search) {
      andConditions.push({
        OR: [
          { modelNo: { contains: search, mode: "insensitive" } },
          { color: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { material: { contains: search, mode: "insensitive" } },
          { group_name: { contains: search, mode: "insensitive" } },
          { kind_name: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // تحويل ID التصنيف الرقمي إلى اسم التصنيف إن وُجد
    let categoryName = categoryParam;
    if (categoryParam && !isNaN(parseInt(categoryParam))) {
      const cat = await prisma.categories.findUnique({
        where: { id: parseInt(categoryParam) },
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

    const whereConditions = andConditions.length > 0 ? { AND: andConditions } : {};

    // تصدير الإكسيل للبيانات الخام
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
        size: "ONE SIZE",
        out_price: p.price,
        cur_qty: p.currentStock,
        group_name: p.group_name || "",
        kind_name: p.kind_name || "",
        material: p.material || "",
        images: p.image || "",
      }));

      return NextResponse.json({ success: true, data: exportData });
    }

    // جلب المنتجات مرتبة بالأحدث
    const rawProducts = await prisma.product.findMany({
      where: whereConditions,
      orderBy: { id: "desc" },
    });

    const groupedMap = new Map<string, any>();

    for (const p of rawProducts) {
      const modelId = p.modelNo.trim();
      const colorName = p.color.trim();

      const fallbackImage = `${R2_PUBLIC_URL}/${modelId}-${colorName}.webp`;
      const imageUrl = p.image
        ? normalizePublicImageUrl(p.image)
        : fallbackImage;

      if (!groupedMap.has(modelId)) {
        groupedMap.set(modelId, {
          modelId: modelId,
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

      const item = groupedMap.get(modelId);
      item.cur_qty += p.currentStock;

      item.variants.push({
        id: p.id,
        color: colorName,
        imageUrl: imageUrl,
        cur_qty: p.currentStock,
        price: p.price,
        itemCode: `${modelId}-${colorName}`,
        sizes: ["ONE SIZE"],
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 2️⃣ دالة POST (إضافة وتحديث المنتجات من الداشبورد يدوياً أو عبر إكسيل)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // في حال الإضافة الجماعية عبر إكسيل
    if (Array.isArray(body)) {
      let count = 0;
      for (const item of body) {
        const modelNo = String(item.master_code || item.modelNo || "").trim();
        const color = String(item.color || "افتراضي").trim();
        if (!modelNo) continue;

        await prisma.product.upsert({
          where: {
            modelNo_color: {
              modelNo: modelNo,
              color: color,
            },
          },
          update: {
            description: item.item_name || item.description,
            price: parseFloat(item.out_price || item.price) || 0,
            currentStock: parseInt(item.cur_qty || item.stockQty) || 0,
            stockQty: parseInt(item.cur_qty || item.stockQty) || 0,
            group_name: item.group_name || "",
            kind_name: item.kind_name || "",
            material: item.material || "",
            image: item.images || item.image || "",
          },
          create: {
            modelNo: modelNo,
            color: color,
            description: item.item_name || item.description || `موديل ${modelNo}`,
            price: parseFloat(item.out_price || item.price) || 0,
            currentStock: parseInt(item.cur_qty || item.stockQty) || 0,
            stockQty: parseInt(item.cur_qty || item.stockQty) || 0,
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

    // إضافة صنف فردي
    const modelNo = String(body.master_code || body.modelNo || "").trim();
    const color = String(body.color || "افتراضي").trim();

    if (!modelNo) {
      return NextResponse.json(
        { success: false, error: "كود الموديل مطلوب" },
        { status: 400 }
      );
    }

    const createdProduct = await prisma.product.upsert({
      where: {
        modelNo_color: {
          modelNo: modelNo,
          color: color,
        },
      },
      update: {
        description: body.item_name || body.description,
        price: parseFloat(body.out_price || body.price) || 0,
        currentStock: parseInt(body.cur_qty || body.stockQty) || 0,
        stockQty: parseInt(body.cur_qty || body.stockQty) || 0,
        group_name: body.group_name || "",
        kind_name: body.kind_name || "",
        material: body.material || "",
        image: body.images || body.image || "",
      },
      create: {
        modelNo: modelNo,
        color: color,
        description: body.item_name || body.description || `موديل ${modelNo}`,
        price: parseFloat(body.out_price || body.price) || 0,
        currentStock: parseInt(body.cur_qty || body.stockQty) || 0,
        stockQty: parseInt(body.cur_qty || body.stockQty) || 0,
        group_name: body.group_name || "",
        kind_name: body.kind_name || "",
        material: body.material || "",
        image: body.images || body.image || "",
      },
    });

    return NextResponse.json({ success: true, product: createdProduct });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}