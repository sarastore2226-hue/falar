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

    // تحديث حالة الطلب فقط
    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: {
        status: status,
      },
      include: {
        order_items: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `تم تحديث حالة الطلب إلى ${status}`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);

    if (error.code === "P2025") {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "فشل في تحديث حالة الطلب" },
      { status: 500 }
    );
  }
}
