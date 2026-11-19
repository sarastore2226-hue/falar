import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseLinkRuleInput,
  parsePrefixesJson,
  extractRuleMatch,
  syncAllImageLinkRules,
  SuffixMode,
} from "@/lib/image-linking";

export const dynamic = "force-dynamic";

// GET: جلب جميع قواعد الربط أو معاينة قاعدة قبل حفظها
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const previewInput = searchParams.get("preview");
    const suffixMode = (searchParams.get("suffixMode") || "AUTO") as SuffixMode;

    if (previewInput !== null) {
      try {
        const parsed = parseLinkRuleInput(previewInput, suffixMode);
        const products = await prisma.product.findMany({
          select: { modelNo: true, color: true, image: true },
        });

        const matchedModels = new Set<string>();
        const modelsWithoutImage = new Set<string>();
        const sampleSuffixes = new Map<string, string[]>();

        for (const p of products) {
          const match = extractRuleMatch(
            p.modelNo,
            parsed.prefixes,
            parsed.suffixLength
          );
          if (!match) continue;

          matchedModels.add(p.modelNo);
          if (!p.image || p.image.trim() === "") {
            modelsWithoutImage.add(p.modelNo);
          }

          if (sampleSuffixes.size < 3) {
            const key = match.suffix.toLowerCase();
            if (!sampleSuffixes.has(key)) {
              sampleSuffixes.set(key, match.siblingModels);
            }
          }
        }

        const exampleGroup =
          Array.from(sampleSuffixes.values())[0] ||
          parsed.prefixes.map(
            (p) => p + (parsed.suffixLength > 0 ? "0".repeat(parsed.suffixLength) : "")
          );

        return NextResponse.json({
          success: true,
          valid: true,
          prefixes: parsed.prefixes,
          suffixLength: parsed.suffixLength,
          matchedModelsCount: matchedModels.size,
          modelsWithoutImageCount: modelsWithoutImage.size,
          exampleGroup,
        });
      } catch (err: unknown) {
        return NextResponse.json({
          success: true,
          valid: false,
          error: err instanceof Error ? err.message : "صيغة غير صالحة",
        });
      }
    }

    const rules = await prisma.image_link_rules.findMany({
      orderBy: { id: "desc" },
    });

    return NextResponse.json({
      success: true,
      rules: rules.map((r) => ({
        ...r,
        prefixesList: parsePrefixesJson(r.prefixes),
      })),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "فشل جلب قواعد الربط";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST: حفظ قاعدة ربط جديدة وتطبيقها فوراً على القاعدة
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rawInput?: string;
      name?: string;
      suffixMode?: SuffixMode;
      fallbackAnyColor?: boolean;
      overwriteExisting?: boolean;
    };

    const rawInput = String(body.rawInput || "").trim();
    const suffixMode = (body.suffixMode || "AUTO") as SuffixMode;
    const parsed = parseLinkRuleInput(rawInput, suffixMode);

    const rule = await prisma.image_link_rules.create({
      data: {
        name: body.name?.trim() || parsed.tokens.join(" ↔ "),
        raw_input: rawInput,
        prefixes: JSON.stringify(parsed.prefixes),
        suffix_length: parsed.suffixLength,
        fallback_any_color: Boolean(body.fallbackAnyColor),
        active: true,
      },
    });

    const syncResult = await syncAllImageLinkRules(prisma, {
      ruleId: rule.id,
      overwriteExisting: Boolean(body.overwriteExisting),
    });

    return NextResponse.json({
      success: true,
      rule: {
        ...rule,
        prefixesList: parsed.prefixes,
      },
      syncResult,
      message: `تم حفظ قاعدة الربط وتحديث ${syncResult.updatedCount} صنف مرتبط`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "فشل حفظ قاعدة الربط";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}

// PUT: إعادة مزامنة القواعد أو تفعيل/إيقاف قاعدة
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: number;
      active?: boolean;
      overwriteExisting?: boolean;
    };

    if (body.id && body.active !== undefined) {
      await prisma.image_link_rules.update({
        where: { id: Number(body.id) },
        data: { active: Boolean(body.active) },
      });
      return NextResponse.json({ success: true });
    }

    const syncResult = await syncAllImageLinkRules(prisma, {
      ruleId: body.id ? Number(body.id) : undefined,
      overwriteExisting: Boolean(body.overwriteExisting),
    });

    return NextResponse.json({
      success: true,
      syncResult,
      message: `تمت المزامنة: تم ربط وتحديث ${syncResult.updatedCount} صنف`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "فشل المزامنة";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE: حذف قاعدة ربط
export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) {
      return NextResponse.json(
        { success: false, error: "معرف القاعدة مطلوب" },
        { status: 400 }
      );
    }

    await prisma.image_link_rules.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "تم حذف القاعدة" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "فشل حذف القاعدة";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}