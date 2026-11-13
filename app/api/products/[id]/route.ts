import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePublicImageUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

interface VariantDetail {
  id: string;
  color: string;
  imageUrl: string;
  material: string;
  itemCode: string;
  sizes: string[];
  sizePrices: Record<string, number>;
  sizeQuantities: Record<string, number>;
  sizeItemCodes: Record<string, string>;
  cur_qty: number;
  totalColorQuantity: number;
  stor_id: number;
  material_code?: string | null;
  sizeDetails: Array<{
    uniqueId: string;
    itemCode: string;
    size: string;
    price: number;
    quantity: number;
  }>;
}

interface ProductDetailResponse {
  id: string;
  modelId: string;
  master_code: string;
  price: number;
  category: string;
  group_name: string;
  kind_name: string;
  description: string;
  item_name: string;
  item_code: string;
  image: string;
  cur_qty: number;
  variants: VariantDetail[];
}

interface UpdateVariantInput {
  uniqueId?: string;
  id?: string;
  color?: string;
  out_price?: number | string;
  price?: number | string;
  cur_qty?: number | string;
  quantity?: number | string;
  itemCode?: string;
}

interface UpdateProductInput {
  master_code?: string;
  item_name?: string;
  description?: string;
  group_name?: string;
  kind_name?: string;
  color?: string;
  out_price?: number | string;
  cur_qty?: number | string;
  images?: string;
  image?: string;
  variants?: UpdateVariantInput[];
}

// 1️⃣ GET
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id).trim();

    const { searchParams } = new URL(request.url);
    const employeeView = searchParams.get("employee") === "true";

    const targetProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { id: decodedId },
          { modelNo: decodedId },
          { material: decodedId },
        ],
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
    const whereConditions: {
      modelNo: string;
      OR?: Array<{ status: string } | { currentStock: { gt: number } }>;
    } = { modelNo };

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

    const product: ProductDetailResponse = {
      id: mainInfo.id,
      modelId: mainInfo.modelNo,
      master_code: mainInfo.modelNo,
      price: Number(mainInfo.price) || 0,
      category: mainInfo.group_name || mainInfo.kind_name || mainInfo.material || "عام",
      group_name: mainInfo.group_name || "",
      kind_name: mainInfo.kind_name || "",
      description: mainInfo.description || `موديل ${mainInfo.modelNo}`,
      item_name: mainInfo.description || `موديل ${mainInfo.modelNo}`,
      item_code: mainInfo.material || `${mainInfo.modelNo}${mainInfo.color}`,
      image: mainInfo.image
        ? normalizePublicImageUrl(mainInfo.image) || ""
        : `${R2_PUBLIC_URL}/${mainInfo.modelNo}-${mainInfo.color}.webp`,
      cur_qty: totalQty,
      variants: [],
    };

    const variantsMap = new Map<string, VariantDetail>();

    allVariants.forEach((row) => {
      const color = row.color || "افتراضي";
      const curQty = Number(row.currentStock) || 0;
      const compositeKey = row.material || `${row.modelNo}${color}`;
      const fallbackImage = `${R2_PUBLIC_URL}/${row.modelNo}-${color}.webp`;
      const imageUrl = row.image
        ? normalizePublicImageUrl(row.image) || fallbackImage
        : fallbackImage;

      if (!variantsMap.has(color)) {
        variantsMap.set(color, {
          id: row.id,
          color,
          imageUrl,
          material: compositeKey,
          itemCode: compositeKey,
          sizes: ["ONE SIZE"],
          sizePrices: { "ONE SIZE": Number(row.price) || 0 },
          sizeQuantities: { "ONE SIZE": curQty },
          sizeItemCodes: { "ONE SIZE": compositeKey },
          cur_qty: curQty,
          totalColorQuantity: curQty,
          stor_id: 0,
          material_code: row.material,
          sizeDetails: [
            {
              uniqueId: row.id,
              itemCode: compositeKey,
              size: "ONE SIZE",
              price: Number(row.price) || 0,
              quantity: curQty,
            },
          ],
        });
      } else {
        const existing = variantsMap.get(color)!;
        existing.cur_qty += curQty;
        existing.totalColorQuantity += curQty;
      }
    });

    product.variants = Array.from(variantsMap.values());

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, error: "خطأ في السيرفر: " + errorMsg },
      { status: 500 }
    );
  }
}

// 2️⃣ PUT
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id).trim();
    const body = (await request.json()) as UpdateProductInput;

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
      return NextResponse.json({ success: false, error: "المنتج غير موجود" }, { status: 404 });
    }

    const activeModelNo = allVariants[0].modelNo;

    const sharedData: {
      description?: string;
      group_name?: string;
      kind_name?: string;
      modelNo?: string;
    } = {};

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

    if (Array.isArray(body.variants) && body.variants.length > 0) {
      for (const variant of body.variants) {
        if (!variant.uniqueId && !variant.id) continue;
        const targetId = String(variant.uniqueId || variant.id);
        const price = Number(variant.out_price ?? variant.price);
        const quantity = Number(variant.cur_qty ?? variant.quantity);

        await prisma.product.update({
          where: { id: targetId },
          data: {
            color: variant.color ? variant.color.trim() : undefined,
            price: Number.isFinite(price) ? price : undefined,
            currentStock: Number.isInteger(quantity) ? quantity : undefined,
            stockQty: Number.isInteger(quantity) ? quantity : undefined,
            material: variant.itemCode || undefined,
          },
        });
      }
    } else {
      const targetVariant =
        allVariants.find((v) => body.color && v.color === body.color) ||
        allVariants[0];

      if (targetVariant) {
        const updateData: {
          color?: string;
          price?: number;
          currentStock?: number;
          stockQty?: number;
          image?: string;
        } = {};

        if (body.color) updateData.color = body.color.trim();
        if (body.out_price !== undefined) updateData.price = parseFloat(String(body.out_price)) || 0;
        if (body.cur_qty !== undefined) {
          const qty = parseInt(String(body.cur_qty), 10) || 0;
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
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "فشل في تحديث المنتج";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

// 3️⃣ DELETE
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
      return NextResponse.json({ success: false, error: "المنتج غير موجود" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف الموديل وجميع نسخه بنجاح",
      deletedCount: result.count,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "فشل في حذف المنتج";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}