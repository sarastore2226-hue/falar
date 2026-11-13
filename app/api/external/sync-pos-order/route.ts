import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const SYNC_SECRET = process.env.POS_SYNC_SECRET || "vooy_pos_sync_super_secret_key_2026_xyz";
const STORE_URL = process.env.STORE_PUBLIC_URL || "https://www.vooy.shop";

interface SyncOrderItem {
  modelNo: string;
  color?: string;
  piecesQty: number;
  piecePrice: number;
}

interface SyncOrderPayload {
  posOrderNo: number | string;
  customerName?: string;
  customerPhone: string;
  customerAddress?: string;
  totalAmount: number;
  deposit?: number;
  items: SyncOrderItem[];
  notes?: string;
}

function generateSecureToken(payload: Record<string, unknown>): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  const base64Data = Buffer.from(data).toString("base64url");
  const signature = crypto.createHmac("sha256", SYNC_SECRET).update(base64Data).digest("base64url");
  return `${base64Data}.${signature}`;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("x-pos-sync-secret");
    if (authHeader !== SYNC_SECRET) {
      return NextResponse.json({ success: false, error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const body = (await request.json()) as SyncOrderPayload;
    const {
      posOrderNo,
      customerName,
      customerPhone,
      customerAddress,
      totalAmount,
      deposit = 0,
      items,
    } = body;

    if (!customerPhone || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "بيانات الطلب غير مكتملة" },
        { status: 400 }
      );
    }

    const cleanPhone = String(customerPhone).trim();
    const targetOrderId = `POS-${posOrderNo}`;

    // البحث عن حساب العميل أو إنشاؤه
    let customerUser = await prisma.users.findFirst({
      where: { phone: cleanPhone },
    });

    if (!customerUser) {
      const generatedCode = `CUST-${cleanPhone.slice(-6)}-${Date.now().toString().slice(-4)}`;
      customerUser = await prisma.users.create({
        data: {
          usercode: generatedCode,
          username: customerName || "عميل المعرض",
          password: cleanPhone,
          phone: cleanPhone,
          position: "عميل",
          permissions: "view_products",
        },
      });
    }

    // منع الخصم المكرر: إذا كان الأوردر مسجلاً مسبقاً، نكتفي بإعادة توليد التوكن والرابط
    const existingOrder = await prisma.orders.findUnique({
      where: { id: targetOrderId },
    });

    if (existingOrder) {
      const token = generateSecureToken({
        orderId: targetOrderId,
        userId: customerUser.userid,
        usercode: customerUser.usercode,
        username: customerUser.username,
        phone: customerUser.phone,
        position: customerUser.position,
      });

      return NextResponse.json({
        success: true,
        orderId: targetOrderId,
        url: `${STORE_URL}/order/view?orderId=${targetOrderId}&token=${token}`,
        message: "تم توليد رابط الفاتورة (الأوردر مسجل مسبقاً دون تكرار الخصم)",
      });
    }

    // تسجيل الأوردر الجديد في المتجر
    await prisma.$transaction(async (tx) => {
      await tx.orders.create({
        data: {
          id: targetOrderId,
          customer_name: customerName || customerUser?.username || "عميل المعرض",
          address: customerAddress || "استلام من المعرض",
          phone: cleanPhone,
          total_price: Number(totalAmount) || 0,
          status: deposit >= totalAmount ? "تم التسليم" : "تحت التجهيز",
        },
      });

      for (const item of items) {
        const modelStr = String(item.modelNo).trim();
        const colorStr = String(item.color || "").trim();

        await tx.order_items.create({
          data: {
            order_id: targetOrderId,
            product: `موديل ${modelStr} - اللون: ${colorStr || "افتراضي"}`,
            quantity: Number(item.piecesQty) || 0,
            price: Number(item.piecePrice) || 0,
            color: colorStr,
            item_code: modelStr,
          },
        });
      }
    });

    const token = generateSecureToken({
      orderId: targetOrderId,
      userId: customerUser.userid,
      usercode: customerUser.usercode,
      username: customerUser.username,
      phone: customerUser.phone,
      position: customerUser.position,
    });

    const directOrderUrl = `${STORE_URL}/order/view?orderId=${targetOrderId}&token=${token}`;

    return NextResponse.json({
      success: true,
      orderId: targetOrderId,
      url: directOrderUrl,
      message: "تمت مزامنة الأوردر بنجاح",
    });
  } catch (error: unknown) {
    console.error("Sync POS Order Error:", error);
    const errorMsg = error instanceof Error ? error.message : "فشلت المزامنة";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}