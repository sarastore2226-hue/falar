import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pricePromotionItems } from "../../../lib/promotions";
import { createPaymobCheckoutSession } from "../../../lib/paymob";

const prisma = new PrismaClient();

interface OrderItem {
  product: string;
  color?: string;
  size?: string;
  quantity: number;
  price: number;
  item_code?: string;
  category?: string;
}

interface OrderRequest {
  customer_name: string;
  address: string;
  phone: string;
  items: OrderItem[];
  total_price?: number;
  payment_method?: "cod" | "paymob";
}

class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
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
        { success: false, error: "بيانات الطلب غير مكتملة أو غير صحيحة." },
        { status: 400 }
      );
    }

    // ✅ تم حذف total_price من هنا لحل خطأ ESLint
    const { customer_name, address, phone, items, payment_method = "cod" } = orderData;
    const newOrderId = "ORD-" + new Date().getTime();
    const pricedOrder = await pricePromotionItems(prisma, items);

    const orderItemsWithMergedNames = items.map((item) => ({
      ...item,
      product: `${item.product} - اللون: ${item.color || "غير محدد"} - المقاس: ${item.size || "غير محدد"}`,
    }));

    // حفظ الطلب في قاعدة البيانات وتنقيص المخزون بأمان
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const itemCode = item.item_code?.trim();
        if (!itemCode) continue;

        const product = await tx.products.findFirst({
          where: { item_code: itemCode },
        });

        if (!product) continue;

        const availableQty = Number(product.cur_qty) || 0;

        if (availableQty < item.quantity) {
          throw new InsufficientStockError(
            `الكمية المتاحة غير كافية للمنتج "${item.product}" — المطلوب: ${item.quantity}، المتاح: ${availableQty}`
          );
        }

        await tx.products.update({
          where: { unique_id: product.unique_id },
          data: {
            cur_qty: availableQty - item.quantity,
          },
        });
      }

      await tx.orders.create({
        data: {
          id: newOrderId,
          customer_name: customer_name,
          address: address,
          phone: phone,
          total_price: pricedOrder.total,
          status: payment_method === "paymob" ? "بانتظار الدفع" : "تحت التجهيز",
        },
      });

      for (const [index, item] of orderItemsWithMergedNames.entries()) {
        await tx.order_items.create({
          data: {
            order_id: newOrderId,
            product: item.product,
            quantity: item.quantity,
            price: pricedOrder.items[index].finalUnitPrice,
            color: item.color || "",
            item_code: item.item_code || "",
          },
        });
      }
    });

    // 💳 إذا اختار العميل الدفع الإلكتروني عبر Paymob
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
            phone: phone,
            street: address,
          },
        });

        return NextResponse.json({
          success: true,
          orderId: newOrderId,
          paymentUrl: checkoutUrl,
        });
      } catch (paymobErr: unknown) {
        const errorMsg = paymobErr instanceof Error ? paymobErr.message : "فشل في الاتصال ببوابة الدفع";
        console.error("❌ Paymob checkout error:", errorMsg);

        // إرجاع رسالة الخطأ للعميل مباشرة في الشاشة بدلاً من حفظه كاش تلقائياً
        return NextResponse.json(
          {
            success: false,
            error: errorMsg,
          },
          { status: 500 }
        );
      }
    }

    // الدفع عند الاستلام كاش
    return NextResponse.json({
      success: true,
      orderId: newOrderId,
      message: "تم استلام طلبك بنجاح! رقم الطلب: " + newOrderId,
    });
  } catch (error) {
    console.error("Error in saveOrder API:", error);
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "فشل في حفظ الطلب." },
      { status: 500 }
    );
  }
}