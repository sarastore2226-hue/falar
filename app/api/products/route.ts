import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// ✅ إنشاء الاتصال مباشرة هنا لتجاوز أي مشاكل في الاستيراد
const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// 1️⃣ دالة GET
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const employeeView = searchParams.get("employee") === "true";
    const isExport = searchParams.get("export") === "true";

    const limit = limitParam ? parseInt(limitParam) : 10000;
    const page = pageParam ? parseInt(pageParam) : 1;

    const andConditions: any[] = [];

    if (!employeeView && !isExport) {
      andConditions.push({ cur_qty: { gt: 0 }, stor_id: 0 });
    }

    if (search) {
      const searchOR: any[] = [
        { item_name: { contains: search, mode: "insensitive" } },
        { item_code: { contains: search, mode: "insensitive" } },
        { master_code: { contains: search, mode: "insensitive" } },
      ];
      if (!isNaN(Number(search))) {
        searchOR.push({ unique_id: { equals: Number(search) } });
      }
      andConditions.push({ OR: searchOR });
    }

    let categoryName = category;
    if (category && !isNaN(parseInt(category))) {
      const cat = await prisma.categories.findUnique({
        where: { id: parseInt(category) },
      });
      if (cat) categoryName = cat.name;
    }
    if (categoryName) {
      andConditions.push({
        OR: [
          { group_name: { contains: categoryName, mode: "insensitive" } },
          { kind_name: { contains: categoryName, mode: "insensitive" } },
        ],
      });
    }

    const whereConditions =
      andConditions.length > 0 ? { AND: andConditions } : {};

    // إذا كان تصدير، نجلب البيانات الخام فوراً
    if (isExport) {
      const rawProducts = await prisma.products.findMany({
        where: whereConditions,
        orderBy: { unique_id: "desc" },
      });
      return NextResponse.json({ success: true, data: rawProducts });
    }

    // ✅ جلب المنتجات
    const allProductsRaw = await prisma.products.findMany({
      where: whereConditions,
      orderBy: { unique_id: "desc" },
    });

    // تجميع المنتجات حسب master_code
    const groupedByMasterCode: { [key: string]: any } = {};
    
    allProductsRaw.forEach((row) => {
      const masterCode = row.master_code;
      if (!masterCode) return;

      if (!groupedByMasterCode[masterCode]) {
        groupedByMasterCode[masterCode] = {
          modelId: masterCode,
          master_code: masterCode,
          item_code: row.item_code,
          description: row.item_name || "منتج",
          item_name: row.item_name,
          price: row.out_price || 0,
          cur_qty: 0,
          category: row.group_name || "",
          variants: [],
        };
      }

      const quantity = parseInt(row.cur_qty?.toString() || "0", 10);
      groupedByMasterCode[masterCode].cur_qty += quantity;

      const color = row.color || "Default";
      let variant = groupedByMasterCode[masterCode].variants.find(
        (v: any) => v.color === color
      );

      // ✅ استخراج اسم الصورة من الرابط إذا كان موجوداً
      let imageUrl = row.images || "";
      // إذا كان الرابط من R2، نستخرج اسم الملف (الذي هو item_code)
      let imageFileName = "";
      if (imageUrl && imageUrl.includes('r2.dev')) {
        const urlParts = imageUrl.split('/');
        imageFileName = urlParts[urlParts.length - 1];
        // إزالة الامتداد للحصول على item_code
        if (imageFileName.includes('.')) {
          imageFileName = imageFileName.substring(0, imageFileName.lastIndexOf('.'));
        }
      }

      if (!variant) {
        groupedByMasterCode[masterCode].variants.push({
          id: row.unique_id,
          color: color,
          // ✅ استخدام item_code الخاص بهذا اللون (من قاعدة البيانات)
          item_code: row.item_code || "",
          // ✅ اسم ملف الصورة (الذي هو item_code)
          imageFileName: imageFileName,
          imageUrl: imageUrl,
          sizes: [row.size || "Free"],
          quantities: [quantity],
          sizeItemCodes: { [row.size || "Free"]: row.item_code || "" },
          sizePrices: { [row.size || "Free"]: Number(row.out_price) || 0 },
        });
      } else {
        if (!variant.sizes.includes(row.size || "Free")) {
          variant.sizes.push(row.size || "Free");
        }
        variant.quantities.push(quantity);
        if (row.size) {
          variant.sizeItemCodes[row.size] = row.item_code || "";
        }
        variant.sizePrices[row.size || "Free"] = Number(row.out_price) || 0;
      }
    });

    const allGroupedProducts = Object.values(groupedByMasterCode);
    const totalProducts = allGroupedProducts.length;

    // ✅ تطبيق الترقيم
    let paginatedProducts = allGroupedProducts;
    if (limitParam) {
      const skip = (page - 1) * limit;
      paginatedProducts = allGroupedProducts.slice(skip, skip + limit);
    }

    return NextResponse.json({
      success: true,
      products: paginatedProducts,
      pagination: {
        page,
        limit: limitParam ? limit : totalProducts,
        totalProducts,
        totalPages: limitParam ? Math.ceil(totalProducts / limit) : 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 2️⃣ دالة POST (الرفع والإضافة)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // A. الرفع الجماعي (Array)
    if (Array.isArray(body)) {
      console.log(`🚀 Bulk uploading ${body.length} items...`);

      const cleanData = body.map((item, index) => {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);

        return {
          unique_id: `PRD-${timestamp}-${random}-${index}`.toUpperCase(),
          item_name: item.item_name?.toString() || "بدون اسم",
          master_code: item.master_code?.toString() || "",
          item_code: item.item_code?.toString() || `${item.master_code}-${index}`,
          out_price: parseFloat(item.out_price) || 0,
          cur_qty: parseInt(item.cur_qty) || 0,
          color: item.color?.toString() || "Default",
          size: item.size?.toString() || "Free",
          group_name: item.group_name?.toString() || "عام",
          kind_name: item.kind_name?.toString() || "عام",
          images: item.images?.toString() || "",
          stor_id: 0,
          type_id: 0,
          item_id: 0,
          unit_id: 0,
          unit_convert: 1,
          multi_unit: false,
          multi_type: false,
          unit_def1_id: 0,
          group_id: 0,
          class_id: 0,
          is_basic_unit: true,
          kind_id: 0,
          place_id: 0,
          unit_name_id: 0,
          unit_name: "قطعة",
          class_name: item.group_name?.toString() || "عام",
          place_name: "المخزن الرئيسي",
        };
      });

      const result = await prisma.products.createMany({
        data: cleanData,
        skipDuplicates: true,
      });

      return NextResponse.json({
        success: true,
        message: `تم رفع ${result.count} منتج بنجاح`,
      });
    }

    // B. منتج فردي
    else {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 9);

      const newProduct = await prisma.products.create({
        data: {
          unique_id: `PRD-${timestamp}-${random}`.toUpperCase(),
          ...body,
          out_price: parseFloat(body.out_price),
          cur_qty: parseInt(body.cur_qty),
          stor_id: 0,
          type_id: 0,
          item_id: 0,
          unit_id: 0,
          unit_convert: 1,
          group_id: 0,
          kind_id: 0,
          class_id: 0,
          place_id: 0,
          unit_name_id: 0,
          unit_def1_id: 0,
          multi_unit: false,
          multi_type: false,
          is_basic_unit: true,
        },
      });
      return NextResponse.json({ success: true, product: newProduct });
    }
  } catch (error: any) {
    console.error("❌ Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}