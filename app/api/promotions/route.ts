import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeTiers(tiers: unknown) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error("يجب إضافة شريحة سعر واحدة على الأقل");
  }
  const result = tiers.map((tier: any) => ({
    min_quantity: Number(tier.min_quantity),
    bundle_price: Number(tier.bundle_price),
  }));
  if (result.some((tier) => !Number.isInteger(tier.min_quantity) || tier.min_quantity < 1 || !Number.isFinite(tier.bundle_price) || tier.bundle_price < 0)) {
    throw new Error("بيانات شرائح العرض غير صحيحة");
  }
  return result;
}

export async function GET(request: Request) {
  const activeOnly = new URL(request.url).searchParams.get("active") === "true";
  const now = new Date();
  const promotions = await prisma.promotions.findMany({
    where: activeOnly
      ? {
          active: true,
          AND: [
            { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
            { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
          ],
        }
      : undefined,
    include: { category: true, tiers: { orderBy: { min_quantity: "asc" } } },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json(promotions);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const categoryId = Number(body.category_id);
    if (!name || !Number.isInteger(categoryId)) throw new Error("اسم العرض والتصنيف مطلوبان");
    const tiers = normalizeTiers(body.tiers);
    const promotion = await prisma.promotions.create({
      data: {
        name,
        category_id: categoryId,
        active: body.active !== false,
        starts_at: body.starts_at ? new Date(body.starts_at) : null,
        ends_at: body.ends_at ? new Date(body.ends_at) : null,
        tiers: { create: tiers },
      },
      include: { category: true, tiers: true },
    });
    return NextResponse.json({ success: true, promotion });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل في إنشاء العرض" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const tiers = normalizeTiers(body.tiers);
    if (!Number.isInteger(id)) throw new Error("معرف العرض مطلوب");
    const promotion = await prisma.$transaction(async (tx) => {
      await tx.promotion_tiers.deleteMany({ where: { promotion_id: id } });
      return tx.promotions.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: String(body.name).trim() }),
          ...(body.category_id !== undefined && { category_id: Number(body.category_id) }),
          ...(body.active !== undefined && { active: Boolean(body.active) }),
          starts_at: body.starts_at ? new Date(body.starts_at) : null,
          ends_at: body.ends_at ? new Date(body.ends_at) : null,
          tiers: { create: tiers },
        },
        include: { category: true, tiers: true },
      });
    });
    return NextResponse.json({ success: true, promotion });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل في تعديل العرض" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) throw new Error("معرف العرض مطلوب");
    await prisma.promotions.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل في حذف العرض" }, { status: 400 });
  }
}
