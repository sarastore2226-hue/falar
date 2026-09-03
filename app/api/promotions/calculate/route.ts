import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pricePromotionItems } from "../../../../lib/promotions";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.items)) {
      return NextResponse.json({ success: false, error: "قائمة المنتجات غير صحيحة" }, { status: 400 });
    }
    const result = await pricePromotionItems(prisma, body.items);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل حساب العروض" }, { status: 500 });
  }
}
