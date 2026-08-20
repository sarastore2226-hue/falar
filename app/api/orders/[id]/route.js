import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - جلب طلب محدد بواسطة ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const order = await prisma.orders.findUnique({
      where: { id },
      include: {
        order_items: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    // ✅ تصحيح: جلب حالة الطلب الحقيقية من قاعدة البيانات
    const formattedOrder = {
      id: order.id,
      customer_name: order.customer_name,
      address: order.address,
      phone: order.phone,
      total_price: parseFloat(order.total_price.toString()),
      status: order.status || "تحت التجهيز", // ✅ من قاعدة البيانات وليس قيمة ثابتة
      timestamp: order.timestamp,
      printed_by: order.printed_by || null,
      printed_at: order.printed_at || null,
      exported_by: order.exported_by || null,
      exported_at: order.exported_at || null,
      items: order.order_items.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
        color: item.color,
        item_code: item.item_code,
      })),
    };

    return NextResponse.json(formattedOrder);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "فشل في جلب بيانات الطلب" },
      { status: 500 }
    );
  }
}

// PUT - تحديث طلب محدد
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const data = await request.json();

    const updatedOrder = await prisma.orders.update({
      where: { id },
      data: {
        ...(data.customer_name && { customer_name: data.customer_name }),
        ...(data.address && { address: data.address }),
        ...(data.phone && { phone: data.phone }),
        ...(data.total_price && { total_price: data.total_price }),
        ...(data.status && { status: data.status }), // ✅ يمكن تحديث الحالة
        ...(data.printed_by && { printed_by: data.printed_by }),
        ...(data.printed_at && { printed_at: new Date(data.printed_at) }),
        ...(data.exported_by && { exported_by: data.exported_by }),
        ...(data.exported_at && { exported_at: new Date(data.exported_at) }),
      },
      include: {
        order_items: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم تحديث الطلب بنجاح",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "فشل في تحديث الطلب" }, { status: 500 });
  }
}

// DELETE - حذف طلب محدد مع استرجاع المخزون
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // حذف الطلب واسترجاع المخزون في نفس المعاملة
    await prisma.$transaction(async (tx) => {
      // جلب الطلب الحالي مع عناصره
      const existingOrder = await tx.orders.findUnique({
        where: { id },
        include: { order_items: true },
      });

      if (!existingOrder) {
        return null;
      }

      // ✅ استرجاع المخزون فقط إذا لم يكن الطلب قد استُردّ مخزونه مسبقاً
      // (الطلب المُلغي استُردّ مخزونه عند الإلغاء، فلا نسترجع مرة أخرى)
      if (existingOrder.status !== "ملغي") {
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

      // حذف عناصر الطلب ثم الطلب نفسه
      await tx.order_items.deleteMany({
        where: { order_id: id },
      });

      await tx.orders.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: "تم حذف الطلب بنجاح واسترجاع الكميات إلى المخزون",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json({ error: "فشل في حذف الطلب" }, { status: 500 });
  }
}
