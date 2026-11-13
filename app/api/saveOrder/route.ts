import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pricePromotionItems, PromotionInputItem } from "@/lib/promotions";
import { createPaymobCheckoutSession } from "@/lib/paymob";

interface OrderItem {
  product: string;
  color?: string;
  size?: string;
  quantity: number; // إجمالي القطع (سريات * 4)
  price: number;
  item_code?: string;
  master_code?: string;
  category?: string;
}

interface OrderRequest {
  customer_name: string;
  address: string;
  phone: string;
  items: OrderItem[];
  payment_method?: "cod" | "paymob";
}

export async function POST(request: Request) {
  try {
    const orderData: OrderRequest = await request.json();

    if (
      !orderData ||
      !orderData.customer_name ||
      !orderData.address ||
      !orderData.phone ||
      !orderData.items ||
      orderData.items.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "بيانات الطلب غير مكتملة." },
        { status: 400 }
      );
    }

    const { customer_name, address, phone, items, payment_method = "cod" } = orderData;
    const newOrderId = "ORD-" + Date.now();

    const promotionItems: PromotionInputItem[] = items.map((item) => ({
      product: item.product,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
    }));

    const pricedOrder = await pricePromotionItems(prisma, promotionItems);

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const modelNo = String(item.master_code || item.item_code || "").trim();
        const color = String(item.color || "افتراضي").trim();
        const piecesToDeduct = Number(item.quantity) || 0;

        if (!modelNo) continue;

        let product = await tx.product.findUnique({
          where: {
            modelNo_color: {
              modelNo: modelNo,
              color: color,
            },
          },
        });

        if (!product) {
          product = await tx.product.findFirst({
            where: {
              modelNo: { equals: modelNo, mode: "insensitive" },
              color: { equals: color, mode: "insensitive" },
            },
          });
        }

        if (!product) {
          throw new Error(`الصنف غير متوفر بالمخزن: موديل ${modelNo} لون ${color}`);
        }

        if (product.status !== "OPEN" && product.currentStock < piecesToDeduct) {
          throw new Error(
            `الكمية المتاحة لا تكفي للصنف ${modelNo} (${color}). المتبقي بالمخزن: ${product.currentStock} قطعة.`
          );
        }

        // خصم الرصيد بالقطع من جدول Product الموحد المشترك
        await tx.product.update({
          where: { id: product.id },
          data: {
            currentStock: { decrement: piecesToDeduct },
          },
        });
      }

      await tx.orders.create({
        data: {
          id: newOrderId,
          customer_name,
          address,
          phone,
          total_price: pricedOrder.total,
          status: payment_method === "paymob" ? "بانتظار الدفع" : "تحت التجهيز",
        },
      });

      for (const [index, item] of items.entries()) {
        await tx.order_items.create({
          data: {
            order_id: newOrderId,
            product: `${item.product} - اللون: ${item.color || "افتراضي"}`,
            quantity: item.quantity,
            price: pricedOrder.items[index]?.finalUnitPrice ?? item.price,
            color: item.color || "",
            item_code: item.master_code || item.item_code || "",
          },
        });
      }
    });

    if (payment_method === "paymob") {
      try {
        const names = customer_name.trim().split(" ");
        const firstName = names[0] || "عميل";
        const lastName = names.slice(1).join(" ") || "متجر";

        const { checkoutUrl } = await createPaymobCheckoutSession({
          amountCents: Math.round(pricedOrder.total * 100),
          orderId: newOrderId,
          customer: {
            first_name: firstName,
            last_name: lastName,
            phone,
            street: address,
          },
        });

        return NextResponse.json({
          success: true,
          orderId: newOrderId,
          paymentUrl: checkoutUrl,
        });
      } catch (paymobErr: unknown) {
        const errorMsg = paymobErr instanceof Error ? paymobErr.message : "خطأ في بوابة الدفع";
        return NextResponse.json(
          { success: false, error: errorMsg },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      orderId: newOrderId,
      message: `تم استلام طلبك بنجاح! رقم الطلب: ${newOrderId}`,
    });
  } catch (error: unknown) {
    console.error("SaveOrder Error:", error);
    const errorMsg = error instanceof Error ? error.message : "فشل في حفظ الطلب.";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 400 }
    );
  }
}