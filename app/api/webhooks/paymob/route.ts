import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const obj = body.obj || body;
    const isSuccess = obj.success === true;
    const orderId = obj.order?.special_reference || obj.special_reference;

    if (isSuccess && orderId) {
      await prisma.orders.update({
        where: { id: orderId },
        data: {
          status: "تحت التجهيز",
        },
      });

      console.log(`✅ تم تأكيد دفع الطلب بنجاح عبر Paymob: ${orderId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paymob Webhook Error:", error);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}