import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePublicImageUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

// 1️⃣ GET - جلب تفاصيل الموديل وكافة ألوانه ومقاساته
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id).trim();

    const { searchParams } = new URL(request.url);
    const employeeView = searchParams.get("employee") === "true";

    console.log(`🔍 جلب تفاصيل المنتج ID: ${decodedId}`);

    // البحث عن الموديل بالـ ID أو بكود الموديل modelNo
    const targetProduct = await prisma.product.findFirst({
      where: {
        OR: [{ id: decodedId }, { modelNo: decodedId }],
      },
      select: { modelNo: true },
    });

    if (!targetProduct || !targetProduct.modelNo) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const modelNo = targetProduct.modelNo;
    const whereConditions: any = { modelNo };

    if (!employeeView) {
      whereConditions.OR = [{ status: "OPEN" }, { currentStock: { gt: 0 } }];
    }

    const allVariants = await prisma.product.findMany({
      where: whereConditions,
      orderBy: { color: "asc" },
    });

    if (allVariants.length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد نسخ متاحة لهذا المنتج" },
        { status: 404 }
      );
    }

    const mainInfo = allVariants[0];
    const totalQty = allVariants.reduce((sum, v) => sum + v.currentStock, 0);

    const product = {
      id: mainInfo.id,
      modelId: mainInfo.modelNo,
      master_code: mainInfo.modelNo,
      price: Number(mainInfo.price) || 0,
      category: mainInfo.group_name || mainInfo.kind_name || mainInfo.material || "عام",
      group_name: mainInfo.group_name || "",
      kind_name: mainInfo.kind_name || "",
      description: mainInfo.description || `موديل ${mainInfo.modelNo}`,
      item_name: mainInfo.description || `موديل ${mainInfo.modelNo}`,
      item_code: `${mainInfo.modelNo}-${mainInfo.color}`,
      image: mainInfo.image
        ? normalizePublicImageUrl(mainInfo.image)
        : `${R2_PUBLIC_URL}/${mainInfo.modelNo}-${mainInfo.color}.webp`,
      cur_qty: totalQty,
      variants: [] as any[],
    };

    const variantsMap: { [color: string]: any } = {};

    allVariants.forEach((row) => {
      const color = row.color || "افتراضي";
      const curQty = Number(row.currentStock) || 0;
      const fallbackImage = `${R2_PUBLIC_URL}/${row.modelNo}-${color}.webp`;
      const imageUrl = row.image
        ? normalizePublicImageUrl(row.image)
        : fallbackImage;

      if (!variantsMap[color]) {
        variantsMap[color] = {
          id: row.id,
          color: color,
          imageUrl: imageUrl,
          itemCode: `${row.modelNo}-${color}`,
          sizes: ["ONE SIZE"],
          sizePrices: { "ONE SIZE": Number(row.price) || 0 },
          sizeQuantities: { "ONE SIZE": curQty },
          sizeItemCodes: { "ONE SIZE": `${row.modelNo}-${color}` },
          cur_qty: curQty,
          totalColorQuantity: curQty,
          stor_id: 0,
          material: row.material,
          sizeDetails: [
            {
              uniqueId: row.id,
              itemCode: `${row.modelNo}-${color}`,
              size: "ONE SIZE",
              price: Number(row.price) || 0,
              quantity: curQty,
            },
          ],
        };
      } else {
        variantsMap[color].cur_qty += curQty;
        variantsMap[color].totalColorQuantity += curQty;
      }
    });

    product.variants = Object.values(variantsMap);

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error("❌ Error in single product API:", error);
    return NextResponse.json(
      { success: false, error: "خطأ في السيرفر: " + error.message },
      { status: 500 }
    );
  }
}

// 2️⃣ PUT - تحديث الموديل وكافة نسخه وألوانه وأسعاره من الداشبورد
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id).trim();
    const body = await request.json();

    const targetModelNo = body.master_code || decodedId;

    const allVariants = await prisma.product.findMany({
      where: {
        OR: [
          { modelNo: targetModelNo },
          { modelNo: decodedId },
          { id: decodedId },
        ],
      },
    });

    if (allVariants.length === 0) {
      return NextResponse.json(
        { success: false, error: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const activeModelNo = allVariants[0].modelNo;

    // تحديث البيانات المشتركة
    const sharedData: any = {};
    if (body.item_name || body.description) {
      sharedData.description = body.item_name || body.description;
    }
    if (body.group_name !== undefined) sharedData.group_name = body.group_name;
    if (body.kind_name !== undefined) sharedData.kind_name = body.kind_name;
    if (body.master_code && body.master_code !== activeModelNo) {
      sharedData.modelNo = body.master_code;
    }

    if (Object.keys(sharedData).length > 0) {
      await prisma.product.updateMany({
        where: { modelNo: activeModelNo },
        data: sharedData,
      });
    }

    // تحديث النسخ الفردية إذا أُرسلت كـ variants
    if (Array.isArray(body.variants) && body.variants.length > 0) {
      for (const variant of body.variants) {
        if (!variant.uniqueId && !variant.id) continue;
        const targetId = String(variant.uniqueId || variant.id);
        const price = Number(variant.out_price ?? variant.price);
        const quantity = Number(variant.cur_qty ?? variant.quantity);

        if (!variant.color?.trim()) {
          throw new Error("اللون مطلوب لكل نسخة");
        }
        if (!Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 0) {
          throw new Error("السعر أو الكمية غير صالحة للنسخة " + variant.color);
        }

        await prisma.product.update({
          where: { id: targetId },
          data: {
            color: variant.color.trim(),
            price: price,
            currentStock: quantity,
            stockQty: quantity,
          },
        });
      }
    } else {
      // تحديث نسخة مفردة إذا لم تُرسل مصفوفة
      const targetVariant =
        allVariants.find((v) => body.color && v.color === body.color) ||
        allVariants[0];

      if (targetVariant) {
        const updateData: any = {};
        if (body.color) updateData.color = body.color.trim();
        if (body.out_price !== undefined) updateData.price = parseFloat(body.out_price) || 0;
        if (body.cur_qty !== undefined) {
          const qty = parseInt(body.cur_qty) || 0;
          updateData.currentStock = qty;
          updateData.stockQty = qty;
        }
        if (body.images || body.image) {
          updateData.image = body.images || body.image;
        }

        await prisma.product.update({
          where: { id: targetVariant.id },
          data: updateData,
        });
      }
    }

    return NextResponse.json({ success: true, message: "تم تحديث المنتج بنجاح" });
  } catch (error: any) {
    console.error("❌ Error updating product:", error);
    return NextResponse.json(
      { success: false, error: error.message || "فشل في تحديث المنتج" },
      { status: 500 }
    );
  }
}

// 3️⃣ DELETE - حذف الموديل وجميع نسخه
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id).trim();

    if (!decodedId) {
      return NextResponse.json(
        { success: false, error: "معرف المنتج مطلوب" },
        { status: 400 }
      );
    }

    const result = await prisma.product.deleteMany({
      where: {
        OR: [{ modelNo: decodedId }, { id: decodedId }],
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
  } catch (error: any) {
    console.error("❌ Error deleting product:", error);
    if (error.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: "لا يمكن حذف هذا الصنف لوجود طلبات أو فواتير سابقة مرتبطة به في المعرض.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "فشل في حذف المنتج" },
      { status: 500 }
    );
  }
}