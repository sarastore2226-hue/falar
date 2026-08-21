import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ACTIVE_ORDER_STATUSES = ["جاري", "تحت التجهيز"];

export async function GET() {
  try {
    const orders = await prisma.orders.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
      include: { order_items: true },
      orderBy: { timestamp: "desc" },
    });

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      customer_name: order.customer_name,
      address: order.address,
      phone: order.phone,
      total_price: parseFloat(order.total_price.toString()),
      status: order.status,
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
    }));

    return NextResponse.json(formattedOrders);
  } catch (error) {
    console.error("Error fetching pending orders:", error);
    return NextResponse.json(
      { error: "فشل في جلب الطلبات المعلقة" },
      { status: 500 }
    );
  }
}
