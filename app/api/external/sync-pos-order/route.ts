import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

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

// دالة لتوليد توكن دخول آمن وموقع للعميل
function generateSecureToken(payload: object): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }); // صالح لـ 30 يوم
  const base64Data = Buffer.from(data).toString("base64url");
  const signature = crypto.createHmac("sha256", SYNC_SECRET).update(base64Data).digest("base64url");
  return `${base64Data}.${signature}`;
}

export async function POST(request: Request) {
  try {
    // 1. التحقق من صلاحية مفتاح الأمان
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
        { success: false, error: "بيانات الطلب غير مكتملة (الهاتف والأصناف مطلوبة)" },
        { status: 400 }
      );
    }

    const cleanPhone = String(customerPhone).trim();
    const targetOrderId = `POS-${posOrderNo}`;

    // 2. البحث عن العميل أو إنشاؤه في جدول users
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

    // 3. معالجة وحفظ الطلب وخصم المخزون في Transaction
    await prisma.$transaction(async (tx) => {
      // تفادي التكرار إذا كان مسجلاً سابقاً
      const existingOrder = await tx.orders.findUnique({
        where: { id: targetOrderId },
      });

      if (existingOrder) {
        await tx.order_items.deleteMany({ where: { order_id: targetOrderId } });
        await tx.orders.delete({ where: { id: targetOrderId } });
      }

      // أ) إنشاء الأوردر
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

      // ب) خصم المخزون بالقطع ومطابقة الصور للبند
      for (const item of items) {
        const modelStr = String(item.modelNo).trim();
        const colorStr = String(item.color || "").trim();
        const piecesToDeduct = Number(item.piecesQty) || 0;

        const matchedProduct = await tx.products.findFirst({
          where: {
            master_code: { equals: modelStr, mode: "insensitive" },
            ...(colorStr ? { color: { equals: colorStr, mode: "insensitive" } } : {}),
          },
        });

        // خصم الرصيد بالقطع من المتجر
        if (matchedProduct && piecesToDeduct > 0) {
          const currentQty = Number(matchedProduct.cur_qty) || 0;
          const newQty = Math.max(0, currentQty - piecesToDeduct);

          await tx.products.update({
            where: { unique_id: matchedProduct.unique_id },
            data: { cur_qty: newQty },
          });
        }

        const productName = matchedProduct?.item_name || `موديل ${modelStr}`;
        const itemFullName = `${productName} - اللون: ${colorStr || "افتراضي"}`;

        await tx.order_items.create({
          data: {
            order_id: targetOrderId,
            product: itemFullName,
            quantity: piecesToDeduct,
            price: Number(item.piecePrice) || Number(matchedProduct?.out_price) || 0,
            color: colorStr,
            item_code: matchedProduct?.item_code || modelStr,
          },
        });
      }
    });

    // 4. توليد التوكن ورابط الدخول المباشر
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
      message: "تم حفظ الأوردر وخصم المخزون بنجاح",
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "حدث خطأ أثناء مزامنة الفاتورة مع المتجر";
    console.error("Sync POS Order Error:", errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}