import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // تأكد من مسار prisma لديك

// GET: لجلب إجمالي عدد الزوار (للموظف)
export async function GET(request: Request) {
  try {
    const details = new URL(request.url).searchParams.get("details") === "true";
    // تجميع عدد الزوار من كل الأيام
    const totalVisitors = await prisma.visitor_stats.aggregate({
      _sum: {
        count: true,
      },
    });

    if (details) {
      const dailyVisitors = await prisma.visitor_stats.findMany({
        orderBy: { date: "desc" },
        select: { date: true, count: true },
      });

      return NextResponse.json({
        total: totalVisitors._sum.count || 0,
        daily: dailyVisitors,
      });
    }

    return NextResponse.json({ total: totalVisitors._sum.count || 0 });
  } catch (error) {
    return NextResponse.json({ error: "فشل في جلب البيانات" }, { status: 500 });
  }
}

// POST: لزيادة العداد (عند دخول زائر)
export async function POST() {
  try {
    const today = new Date();
    // ضبط الوقت ليكون بداية اليوم (00:00:00) لضمان توحيد التاريخ
    today.setHours(0, 0, 0, 0);

    // استخدام upsert: إذا كان اليوم موجودًا قم بزيادة العدد، وإذا لم يكن موجودًا أنشئ سجلًا جديدًا
    await prisma.visitor_stats.upsert({
      where: {
        date: today,
      },
      update: {
        count: {
          increment: 1,
        },
      },
      create: {
        date: today,
        count: 1,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Visitor error:", error);
    return NextResponse.json({ error: "فشل في تسجيل الزيارة" }, { status: 500 });
  }
}