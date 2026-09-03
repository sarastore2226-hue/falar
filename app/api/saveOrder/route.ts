import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pricePromotionItems } from "../../../lib/promotions";

const prisma = new PrismaClient();

// Define types for better TypeScript support
interface OrderItem {
  product: string;
  color?: string;
  size?: string; // ✅ إضافة size
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
  total_price: number;
}

// رسالة خطأ واضحة عندما لا تتوفر كمية كافية
class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}

export async function POST(request: Request) {
  try {
    // 1. Parse the incoming order data from the request body
    const orderData: OrderRequest = await request.json();

    // 2. Validate the data
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

    const { customer_name, address, phone, items, total_price } = orderData;
    const newOrderId = "ORD-" + new Date().getTime(); // Generate a unique order ID
    const pricedOrder = await pricePromotionItems(prisma, items);

    // ✅ تعديل: دمج اسم المنتج + اللون + المقاس في عمود product
    const orderItemsWithMergedNames = items.map((item) => ({
      ...item,
      // دمج اسم المنتج مع اللون والمقاس
      product: `${item.product} - اللون: ${item.color || "غير محدد"} - المقاس: ${item.size || "غير محدد"}`,
    }));

    // 3. Use a Prisma transaction to save everything safely
    await prisma.$transaction(async (tx) => {
      // 3.1 التحقق من المخزون وتنقيصه أولاً (قبل إنشاء الطلب)
      for (const item of items) {
        const itemCode = item.item_code?.trim();
        if (!itemCode) continue;

        // العثور على المنتج المطابق
        const product = await tx.products.findFirst({
          where: { item_code: itemCode },
        });

        if (!product) continue;

        const availableQty = Number(product.cur_qty) || 0;

        // التحقق من توفر الكمية المطلوبة
        if (availableQty < item.quantity) {
          throw new InsufficientStockError(
            `الكمية المتاحة غير كافية للمنتج "${item.product}" — المطلوب: ${item.quantity}، المتاح: ${availableQty}`
          );
        }

        // تنقيص المخزون
        await tx.products.update({
          where: { unique_id: product.unique_id },
          data: {
            cur_qty: availableQty - item.quantity,
          },
        });
      }

      // Create the main order record
      await tx.orders.create({
        data: {
          id: newOrderId,
          customer_name: customer_name,
          address: address,
          phone: phone,
          total_price: pricedOrder.total,
          status: "تحت التجهيز",
        },
      });

      // Create the associated order items
      for (const [index, item] of orderItemsWithMergedNames.entries()) { // ✅ استخدام البيانات المدمجة
        await tx.order_items.create({
          data: {
            order_id: newOrderId,
            product: item.product, // ✅ الآن يحتوي على الاسم + اللون + المقاس
            quantity: item.quantity,
            price: pricedOrder.items[index].finalUnitPrice,
            color: item.color || "",
            item_code: item.item_code || "",
          },
        });
      }
    });

    // 4. Send a success response back to the client
    return NextResponse.json({
      success: true,
      orderId: newOrderId,
      message: "تم استلام طلبك بنجاح! رقم الطلب: " + newOrderId,
    });
  } catch (error) {
    console.error("Error in saveOrder API:", error);
    // إرجاع رسالة واضحة للمستخدم عند نقص المخزون
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    // In case of an error, send a generic error message
    return NextResponse.json(
      { success: false, error: "فشل في حفظ الطلب." },
      { status: 500 }
    );
  }
}