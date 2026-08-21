import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ منع الكاش نهائياً لضمان جلب كل البيانات الجديدة
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeView = searchParams.get("employee") === "true";

    // ✅ طباعة للتأكد من الطلب
    console.log("🚀 getAllData: Start fetching ALL products...");

    const whereConditions: any = {};

    if (!employeeView) {
      whereConditions.cur_qty = { gt: 0 };
      whereConditions.stor_id = 0;
    }

    // ✅ الخطوة الحاسمة: إزالة أي take أو limit نهائياً
    const productsRaw = await prisma.products.findMany({
      where: whereConditions,
      orderBy: {
        item_name: "asc", // ترتيب أبجدي
      },
      // ❌ تم حذف take: limit تماماً
    });

    console.log(`📦 تم جلب ${productsRaw.length} سطر من قاعدة البيانات`);

    const categories = await prisma.categories.findMany();

    // --- منطق التجميع (Grouping) ---
    const groupedByMasterCode: { [key: string]: any } = {};

    productsRaw.forEach((row) => {
      const masterCode = row.master_code;
      // تجاهل المنتجات التي ليس لها كود ماستر
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
        // معالجة الصورة
        let imageUrl =
          "https://via.placeholder.com/500x700/EFEFEF/666666?text=No+Image";
        if (row.images) {
          const img = row.images.trim();
          if (img !== "" && img !== "null" && img !== "NULL") {
            if (img.startsWith("data:image") && img.length > 100) {
              imageUrl = img;
            } else if (img.startsWith("http") || img.startsWith("/")) {
              imageUrl = img;
            } else if (img.length > 50) {
              imageUrl = `data:image/jpeg;base64,${img}`;
            }
          }
        }

        variant = {
          id: row.unique_id,
          itemCode: itemCode,
          color: color,
          imageUrl: imageUrl,
          sizes: [],
          cur_qty: curQty,
          stor_id: row.stor_id || 0,
          sizeItemCodes: {},
          sizeQuantities: {},
          sizePrices: {},
        };
        groupedByMasterCode[masterCode].variants.push(variant);

        if (!groupedByMasterCode[masterCode].item_code) {
          groupedByMasterCode[masterCode].item_code = itemCode;
        }
      } else {
        variant.cur_qty += curQty;
      }

      groupedByMasterCode[masterCode].cur_qty += curQty;

      if (size && !variant.sizes.includes(size)) {
        variant.sizes.push(size);
      }

      if (size) {
        variant.sizeQuantities = variant.sizeQuantities || {};
        variant.sizeQuantities[size] =
          (variant.sizeQuantities[size] || 0) + curQty;
        variant.sizeItemCodes = variant.sizeItemCodes || {};
        variant.sizeItemCodes[size] = itemCode;
        variant.sizePrices = variant.sizePrices || {};
        variant.sizePrices[size] = Number(row.out_price) || 0;
      }

      if (!size && itemCode) {
        variant.itemCode = itemCode;
      }
    });

    const finalProducts = Object.values(groupedByMasterCode).filter(
      (product) => product.variants.length > 0
    );

    console.log(`🎯 العدد النهائي للموديلات: ${finalProducts.length}`);

    // إحصائيات الصور
    const productsWithImages = finalProducts.filter((p) =>
      p.variants.some(
        (v: any) =>
          !v.imageUrl.includes("placeholder.com") &&
          !v.imageUrl.includes("via.placeholder")
      )
    ).length;

    return NextResponse.json({
      success: true,
      products: finalProducts,
      categories: categories,
      total: finalProducts.length,
      stats: {
        rawProducts: productsRaw.length,
        groupedProducts: finalProducts.length,
        productsWithRealImages: productsWithImages,
      },
      filters: {
        employee: employeeView,
      },
    });
  } catch (error: any) {
    console.error("❌ Error in getAllData API:", error);
    return NextResponse.json({
      success: false,
      products: [],
      categories: [],
      error: error.message || "حدث خطأ في تحميل البيانات",
    });
  }
}
