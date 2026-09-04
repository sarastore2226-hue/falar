import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // في Next.js 15 params عبارة عن Promise يجب انتظاره
    const { id } = await params;

    // نحدد إذا كان الطلب من موظف لعرض الكميات الصفرية
    const { searchParams } = new URL(request.url);
    const employeeView = searchParams.get("employee") === "true";

    console.log(`🔍 جلب تفاصيل المنتج ID: ${id}`);

    // 1. أولاً: نبحث عن أي سجل يطابق هذا المعرف (سواء كان كود رئيسي، فريد، أو كود صنف)
    // لنعرف ما هو الـ master_code الخاص به
    const targetProduct = await prisma.products.findFirst({
      where: {
        OR: [
          { unique_id: String(id) },
          { master_code: String(id) },
          { item_code: String(id) },
        ],
      },
      select: { master_code: true },
    });

    if (!targetProduct || !targetProduct.master_code) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const masterCode = targetProduct.master_code;

    // 2. ثانياً: نجلب كل النسخ (الألوان والمقاسات) التابعة لهذا الكود الرئيسي
    const whereConditions: any = {
      master_code: masterCode,
    };

    // إذا لم يكن موظفاً، نخفي الكميات الصفرية والمخازن غير المتاحة (حسب المنطق الخاص بك)
    if (!employeeView) {
      whereConditions.cur_qty = { gt: 0 };
      whereConditions.stor_id = 0;
    }

    const allVariants = await prisma.products.findMany({
      where: whereConditions,
      orderBy: { unique_id: "asc" },
    });

    if (allVariants.length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد نسخ متاحة لهذا المنتج" },
        { status: 404 }
      );
    }

    // 3. ثالثاً: تجميع البيانات بنفس هيكلية الـ Frontend
    // نأخذ البيانات الوصفية من أول عنصر
    const mainInfo = allVariants[0];

    const product = {
      id: mainInfo.unique_id, // نعيد الـ ID المطلوب
      modelId: mainInfo.master_code,
      master_code: mainInfo.master_code,
      price: Number(mainInfo.out_price) || 0,
      category: mainInfo.group_name || mainInfo.kind_name || "",
      // هنا الإصلاح: نستخدم item_name بدلاً من description
      description: mainInfo.item_name || mainInfo.kind_name || "منتج بدون اسم",
      item_code: mainInfo.item_code,
      image: mainInfo.images, // الصورة الرئيسية
      variants: [] as any[],
      cur_qty: 0, // إجمالي الكمية
    };

    // تجميع الـ Variants
    const variantsMap: { [color: string]: any } = {};

    allVariants.forEach((row) => {
      const color = row.color || "Default";
      const size = row.size || null;
      const curQty = Number(row.cur_qty) || 0;

      product.cur_qty += curQty;

      if (!variantsMap[color]) {
        // معالجة الصورة
        let imageUrl = row.images;
        if (
          !imageUrl ||
          imageUrl === "null" ||
          (imageUrl.startsWith("data:") && imageUrl.length < 100)
        ) {
          imageUrl =
            "https://via.placeholder.com/500x700/EFEFEF/666666?text=No+Image";
        }

        variantsMap[color] = {
          id: row.unique_id,
          color: color,
          imageUrl: imageUrl,
          itemCode: row.item_code, // كود اللون
          sizes: [],
          sizePrices: {},
          sizeQuantities: {},
          sizeItemCodes: {},
          cur_qty: 0, // إجمالي كمية هذا اللون
          stor_id: row.stor_id,
          sizeDetails: [],
        };
      }

      const variant = variantsMap[color];
      variant.cur_qty += curQty;

      if (size) {
        if (!variant.sizes.includes(size)) {
          variant.sizes.push(size);
        }
        variant.sizeQuantities[size] = curQty;
        if (row.item_code) {
          variant.sizeItemCodes[size] = row.item_code;
        }
        variant.sizePrices[size] = Number(row.out_price) || 0;
        variant.sizeDetails.push({
          uniqueId: row.unique_id,
          itemCode: row.item_code || "",
          size,
          price: Number(row.out_price) || 0,
          quantity: curQty,
        });
      }
    });

    product.variants = Object.values(variantsMap);

    return NextResponse.json({
      success: true,
      product: product,
    });
  } catch (error) {
    console.error("❌ Error in single product API:", error);
    return NextResponse.json(
      { success: false, error: "خطأ في السيرفر" },
      { status: 500 }
    );
  }
}

// PUT - تحديث منتج وكل نسخه (الألوان والمقاسات) حسب master_code
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 1. نحدد الـ master_code: إما من المسار مباشرة أو من جسم الطلب
    const masterCode = body.master_code || id;

    // 2. نجلب كل النسخ التابعة لهذا الكود الرئيسي
    const allVariants = await prisma.products.findMany({
      where: { master_code: id },
    });

    if (allVariants.length === 0) {
      return NextResponse.json(
        { success: false, error: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    // 3. البيانات المشتركة التي تُطبّق على كل النسخ
    const sharedData: any = {
      item_name: body.item_name,
      group_name: body.group_name,
      kind_name: body.kind_name,
    };

    if (masterCode) sharedData.master_code = masterCode;

    // 4. تحديث كل النسخ (البيانات المشتركة)
    await prisma.products.updateMany({
      where: { master_code: id },
      data: sharedData,
    });

    // 5. تحديث النسخة المحددة (اللون/المقاس/الكود/الكمية/الصورة)
    // نبحث عن السجل المطابق للكود المرسل أو أول نسخة
    const targetVariant =
      allVariants.find(
        (v) => body.item_code && v.item_code === body.item_code
      ) ||
      allVariants.find((v) => v.color === body.color && v.size === body.size) ||
      allVariants[0];

    if (targetVariant) {
      await prisma.products.update({
        where: { unique_id: targetVariant.unique_id },
        data: {
          item_code: body.item_code || targetVariant.item_code,
          color: body.color || targetVariant.color,
          size: body.size || targetVariant.size,
          out_price:
            body.out_price !== undefined
              ? parseFloat(body.out_price) || 0
              : targetVariant.out_price,
          cur_qty: parseInt(body.cur_qty) || 0,
          images: body.images || targetVariant.images,
        },
      });
    }

    if (Array.isArray(body.variants)) {
      for (const variant of body.variants) {
        if (!variant.uniqueId) continue;
        if (!variant.color?.trim() || !variant.size?.trim()) {
          throw new Error("اللون والمقاس مطلوبان لكل نسخة");
        }
        const price = Number(variant.out_price);
        const quantity = Number(variant.cur_qty);
        if (!Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 0) {
          throw new Error("السعر والكمية غير صحيحين");
        }
        await prisma.products.update({
          where: { unique_id: String(variant.uniqueId) },
          data: {
            item_code: variant.itemCode || undefined,
            color: variant.color.trim(),
            size: variant.size.trim(),
            out_price: price,
            cur_qty: quantity,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث المنتج بنجاح",
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    return NextResponse.json(
      { success: false, error: "فشل في تحديث المنتج" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = String(id).trim();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "معرف المنتج مطلوب" },
        { status: 400 }
      );
    }

    const result = await prisma.products.deleteMany({
      where: {
        OR: [{ master_code: productId }, { unique_id: productId }],
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف الموديل وجميع نسخه بنجاح",
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    return NextResponse.json(
      { success: false, error: "فشل في حذف المنتج" },
      { status: 500 }
    );
  }
}
