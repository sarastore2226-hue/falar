import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const SYNC_SECRET =
  process.env.POS_SYNC_SECRET || "vooy_pos_sync_super_secret_key_2026_xyz";
const STORE_URL = process.env.STORE_PUBLIC_URL || "https://www.vooy.shop";

interface SyncCustomerPayload {
  customerName?: string;
  customerPhone: string;
  customerAddress?: string;
}

function generateSecureToken(payload: Record<string, unknown>): string {
  const data = JSON.stringify({
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });
  const base64Data = Buffer.from(data).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SYNC_SECRET)
    .update(base64Data)
    .digest("base64url");
  return `${base64Data}.${signature}`;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("x-pos-sync-secret");
    if (authHeader !== SYNC_SECRET) {
      return NextResponse.json(
        { success: false, error: "غير مصرح لك بالوصول" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as SyncCustomerPayload;
    const cleanPhone = String(body.customerPhone || "").trim();
    const cleanName = String(body.customerName || "").trim();
    const cleanAddress = String(body.customerAddress || "").trim();

    if (!cleanPhone) {
      return NextResponse.json(
        { success: false, error: "رقم هاتف العميل مطلوب" },
        { status: 400 }
      );
    }

    let customerUser = await prisma.users.findFirst({
      where: { phone: cleanPhone },
    });

    if (!customerUser) {
      const generatedCode = `CUST-${cleanPhone.slice(-6)}-${Date.now()
        .toString()
        .slice(-4)}`;
      customerUser = await prisma.users.create({
        data: {
          usercode: generatedCode,
          username: cleanName || "عميل المعرض",
          password: cleanPhone,
          phone: cleanPhone,
          position: "عميل",
          permissions: "view_products",
        },
      });
    } else if (
      cleanName &&
      (!customerUser.username || customerUser.username === "عميل المعرض")
    ) {
      customerUser = await prisma.users.update({
        where: { userid: customerUser.userid },
        data: { username: cleanName },
      });
    }

    const resolvedAddress =
      cleanAddress && cleanAddress !== "استلام من المعرض" ? cleanAddress : "";

    const token = generateSecureToken({
      userId: customerUser.userid,
      usercode: customerUser.usercode,
      username: cleanName || customerUser.username,
      phone: customerUser.phone,
      address: resolvedAddress,
      position: customerUser.position,
    });

    const directHomeUrl = `${STORE_URL}/?token=${token}`;

    return NextResponse.json({
      success: true,
      url: directHomeUrl,
      userId: customerUser.userid,
      message: "تم تجهيز حساب ورابط العميل بنجاح",
    });
  } catch (error: unknown) {
    console.error("Sync POS Customer Error:", error);
    const errorMsg =
      error instanceof Error ? error.message : "فشلت المزامنة";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}