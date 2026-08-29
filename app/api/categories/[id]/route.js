export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ دالة مساعدة للبحث عن التصنيف بالـ ID أو الاسم
async function findCategoryByIdOrName(identifier) {
  // أولاً: تحقق إذا كان identifier رقم (ID)
  const id = parseInt(identifier);
  if (!isNaN(id)) {
    const categoryById = await prisma.categories.findUnique({
      where: { id: id },
    });
    if (categoryById) {
      console.log("✅ وجدت التصنيف بالـ ID:", { id, name: categoryById.name });
      return categoryById;
    }
  }

  // ثانياً: البحث بالاسم
  const categoryByName = await prisma.categories.findFirst({
    where: {
      name: {
        equals: identifier,
        mode: "insensitive",
      },
    },
  });

  if (categoryByName) {
    console.log("✅ وجدت التصنيف بالاسم:", {
      name: categoryByName.name,
      id: categoryByName.id,
    });
    return categoryByName;
  }

  return null;
}

// GET - جلب تصنيف محدد بواسطة الاسم أو الـ ID
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const decodedIdentifier = decodeURIComponent(id);

    console.log("🔍 البحث عن التصنيف:", decodedIdentifier);

    // ✅ البحث باستخدام الدالة المساعدة
    const category = await findCategoryByIdOrName(decodedIdentifier);

    if (!category) {
      console.log("❌ التصنيف غير موجود:", decodedIdentifier);

      // ✅ عرض جميع التصنيفات المتاحة
      const allCategories = await prisma.categories.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(
        {
          error: "التصنيف غير موجود",
          requestedId: decodedIdentifier,
          availableCategories: allCategories.map((c) => ({
            id: c.id,
            name: c.name,
          })),
        },
        { status: 404 }
      );
    }

    console.log("✅ التصنيف موجود:", category);
    return NextResponse.json(category);
  } catch (error) {
    console.error("❌ Error fetching category:", error);
    return NextResponse.json(
      { error: "فشل في جلب بيانات التصنيف" },
      { status: 500 }
    );
  }
}

// PUT - تحديث تصنيف محدد
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const decodedIdentifier = decodeURIComponent(id);
    const data = await request.json();

    const category = await findCategoryByIdOrName(decodedIdentifier);

    if (!category) {
      return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });
    }

    // ✅ منع إنشاء دورات: لا يمكن أن يكون التصنيف فرعاً من نفسه أو من أحد فروعه
    if (data.sub && data.sub !== category.name) {
      let parentName = data.sub;
      const visited = new Set();
      while (parentName && !visited.has(parentName)) {
        visited.add(parentName);
        if (parentName === category.name) {
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

    const updatedCategory = await prisma.categories.update({
      where: { id: category.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.image !== undefined && { image: data.image }),
        ...(data.kind && { kind: data.kind }),
        ...(data.sub !== undefined && { sub: data.sub }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم تحديث التصنيف بنجاح",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "فشل في تحديث التصنيف" },
      { status: 500 }
    );
  }
}

// DELETE - حذف تصنيف محدد
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const decodedIdentifier = decodeURIComponent(id);

    const category = await findCategoryByIdOrName(decodedIdentifier);

    if (!category) {
      return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });
    }

    await prisma.categories.delete({
      where: { id: category.id },
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
