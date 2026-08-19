import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(request) {
  try {
    const { orderId, status } = await request.json();

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "رقم الطلب والحالة مطلوبان" },
        { status: 400 }
      );
    }

    // التحقق من أن الحالة مسموحة
    const allowedStatuses = ["جاري", "تم", "ملغي"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "الحالة غير مسموحة. المسموح: جاري، تم، ملغي" },
        { status: 400 }
      );
    }

    // تحديث حالة الطلب واسترجاع المخزون عند الإلغاء (في نفس المعاملة)
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // جلب الطلب الحالي مع عناصره
      const existingOrder = await tx.orders.findUnique({
        where: { id: orderId },
        include: { order_items: true },
      });

      if (!existingOrder) {
        return null;
      }

      const wasCancelled = existingOrder.status === "ملغي";
      const isCancelling = status === "ملغي";

      // ✅ عند الإلغاء: استرجاع الكميات إلى المخزون
      if (isCancelling && !wasCancelled) {
        for (const item of existingOrder.order_items) {
          const itemCode = item.item_code?.trim();
          if (!itemCode) continue;

          const product = await tx.products.findFirst({
            where: { item_code: itemCode },
          });

          if (!product) continue;

          await tx.products.update({
            where: { unique_id: product.unique_id },
            data: {
              cur_qty: (Number(product.cur_qty) || 0) + item.quantity,
            },
          });
        }
      }

      // ✅ عند إعادة تفعيل طلب ملغي (إلى جاري/تم): خصم الكميات مجدداً
      if (!isCancelling && wasCancelled) {
        for (const item of existingOrder.order_items) {
          const itemCode = item.item_code?.trim();
          if (!itemCode) continue;

          const product = await tx.products.findFirst({
            where: { item_code: itemCode },
          });

          if (!product) continue;

          const availableQty = Number(product.cur_qty) || 0;

          if (availableQty < item.quantity) {
            throw new Error(
              `الكمية المتاحة غير كافية لإعادة تفعيل الطلب للمنتج "${item.product}" — المطلوب: ${item.quantity}، المتاح: ${availableQty}`
            );
          }

          await tx.products.update({
            where: { unique_id: product.unique_id },
            data: {
              cur_qty: availableQty - item.quantity,
            },
          });
        }
      }

      // تحديث حالة الطلب
      return await tx.orders.update({
        where: { id: orderId },
        data: {
          status: status,
        },
        include: {
          order_items: true,
        },
      });
    });

    if (!updatedOrder) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `تم تحديث حالة الطلب إلى ${status}`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);

    if (error.message?.includes("غير كافية")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error.code === "P2025") {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "فشل في تحديث حالة الطلب" },
      { status: 500 }
    );
  }
}
