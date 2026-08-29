import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - جلب جميع التصنيفات
export async function GET() {
  try {
    const categories = await prisma.categories.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "فشل في جلب التصنيفات" },
      { status: 500 }
    );
  }
}

// POST - إنشاء تصنيف جديد
export async function POST(request) {
  try {
    const { name, image, kind, sub } = await request.json();

    if (!name || !kind) {
      return NextResponse.json(
        { error: "الاسم والنوع مطلوبان" },
        { status: 400 }
      );
    }

    // التحقق من عدم وجود تصنيف بنفس الاسم
    const existingCategory = await prisma.categories.findUnique({
      where: { name },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "هذا التصنيف موجود بالفعل" },
        { status: 400 }
      );
    }

    const category = await prisma.categories.create({
      data: {
        name,
        image: image || null,
        kind,
        sub: sub || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم إنشاء التصنيف بنجاح",
      category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "فشل في إنشاء التصنيف" },
      { status: 500 }
    );
  }
}

// PUT - تحديث تصنيف
export async function PUT(request) {
  try {
    const { id, name, image, kind, sub } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "معرف التصنيف مطلوب" },
        { status: 400 }
      );
    }

    const categoryId = parseInt(id);
    const existingCategory = await prisma.categories.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "التصنيف غير موجود" },
        { status: 404 }
      );
    }

    // ✅ منع إنشاء دورات: لا يمكن أن يكون التصنيف فرعاً من نفسه أو من أحد فروعه
    if (sub && sub !== existingCategory.name) {
      let parentName = sub;
      const visited = new Set();
      while (parentName && !visited.has(parentName)) {
        visited.add(parentName);
        if (parentName === existingCategory.name) {
          return NextResponse.json(
            { error: "لا يمكن أن يكون التصنيف فرعاً من نفسه أو من أحد فروعه" },
            { status: 400 }
          );
        }
        const parent = await prisma.categories.findFirst({
          where: { name: parentName },
        });
        if (!parent) break;
        parentName = parent.sub;
      }
    }

    const category = await prisma.categories.update({
      where: { id: categoryId },
      data: {
        ...(name && { name }),
        ...(image !== undefined && { image }),
        ...(kind && { kind }),
        ...(sub !== undefined && { sub }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم تحديث التصنيف بنجاح",
      category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "فشل في تحديث التصنيف" },
      { status: 500 }
    );
  }
}

// DELETE - حذف تصنيف
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "معرف التصنيف مطلوب" },
        { status: 400 }
      );
    }

    await prisma.categories.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({
      success: true,
      message: "تم حذف التصنيف بنجاح",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ error: "فشل في حذف التصنيف" }, { status: 500 });
  }
}
