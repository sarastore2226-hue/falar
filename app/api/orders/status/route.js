import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request) {
  try {
    const { orderId, status } = await request.json();

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "رقم الطلب والحالة مطلوبان" },
        { status: 400 }
      );
    }

    const allowedStatuses = ["تحت التجهيز", "جاري الشحن", "تم التسليم", "ملغي"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "الحالة غير مسموحة. المسموح: تحت التجهيز، جاري الشحن، تم التسليم، ملغي" },
        { status: 400 }
      );
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.orders.findUnique({
        where: { id: orderId },
        include: { order_items: true },
      });

      if (!existingOrder) {
        return null;
      }

      const isPosCopy = existingOrder.id.startsWith("POS-");
      const wasCancelled = existingOrder.status === "ملغي";
      const isCancelling = status === "ملغي";

      if (!isPosCopy && isCancelling && !wasCancelled) {
        for (const item of existingOrder.order_items) {
          const modelNo = item.item_code?.trim();
          const color = item.color?.trim() || "افتراضي";
          if (!modelNo) continue;

          let product = await tx.product.findFirst({
            where: {
              modelNo: { equals: modelNo, mode: "insensitive" },
              color: { equals: color, mode: "insensitive" },
            },
          });

          if (!product) {
            product = await tx.product.findFirst({
              where: {
                material: { equals: modelNo, mode: "insensitive" },
              },
            });
          }

          if (!product) continue;

          await tx.product.update({
            where: { id: product.id },
            data: {
              currentStock: { increment: Number(item.quantity) || 0 },
            },
          });
        }
      }

      if (!isPosCopy && !isCancelling && wasCancelled) {
        for (const item of existingOrder.order_items) {
          const modelNo = item.item_code?.trim();
          const color = item.color?.trim() || "افتراضي";
          if (!modelNo) continue;

          let product = await tx.product.findFirst({
            where: {
              modelNo: { equals: modelNo, mode: "insensitive" },
              color: { equals: color, mode: "insensitive" },
            },
          });

          if (!product) {
            product = await tx.product.findFirst({
              where: {
                material: { equals: modelNo, mode: "insensitive" },
              },
            });
          }

          if (!product) continue;

          const availableQty = Number(product.currentStock) || 0;

          if (product.status !== "OPEN" && availableQty < item.quantity) {
            throw new Error(
              `الكمية المتاحة غير كافية لإعادة تفعيل الطلب للمنتج "${item.product}" — المطلوب: ${item.quantity}، المتاح: ${availableQty}`
            );
          }

          await tx.product.update({
            where: { id: product.id },
            data: {
              currentStock: { decrement: Number(item.quantity) || 0 },
            },
          });
        }
      }

      return await tx.orders.update({
        where: { id: orderId },
        data: { status },
        include: { order_items: true },
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