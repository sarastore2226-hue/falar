import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { orderId, printedBy } = await request.json();

    if (!orderId || !printedBy) {
      return NextResponse.json(
        { error: "رقم الطلب واسم الموظف مطلوبان" },
        { status: 400 }
      );
    }

    // تحديث الطلب - تغيير الحالة إلى "جاري الشحن" وتسجيل بيانات الطباعة
    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: {
        status: "جاري الشحن",
        printed_by: printedBy,
        printed_at: new Date(),
      },
      include: {
        order_items: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم تحديث حالة الطلب وتسجيل عملية الطباعة بنجاح",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order print status:", error);

    // في حالة الخطأ، نتحقق إذا كان الطلب غير موجود
    if (error.code === "P2025") {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "فشل في تحديث حالة الطلب" },
      { status: 500 }
    );
  }
}
