import { PrismaClient } from "@prisma/client";

export type SuffixMode = "AUTO" | "0" | "2" | "3";

export interface ParsedLinkRule {
  tokens: string[];
  prefixes: string[];
  suffixLength: number;
}

export interface StoredImageLinkRule {
  id: number;
  name: string | null;
  raw_input: string;
  prefixes: string;
  suffix_length: number;
  fallback_any_color: boolean;
  active: boolean;
}

export function normalizeColorToken(color: string): string {
  return String(color || "")
    .trim()
    .toLowerCase()
    .replace(/[*?:/\\|<>"]/g, "_");
}

/**
 * تحليل إدخال المستخدم مثل:
 * "300 و 400 و 500" أو "3700, 4700, 5700" أو "600, 700" أو "w1000, w2000" أو "w1099, w2099"
 */
export function parseLinkRuleInput(
  rawInput: string,
  suffixMode: SuffixMode = "AUTO"
): ParsedLinkRule {
  const normalizedSeparators = String(rawInput || "")
    .replace(/([0-9a-zA-Z])و(?=[0-9a-zA-Z])/g, "$1,")
    .trim();

  const tokens = normalizedSeparators
    .split(/[\s,،+/|؛;=]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t !== "و");

  const uniqueTokens = Array.from(new Set(tokens));
  if (uniqueTokens.length < 2) {
    throw new Error("أدخل موديلين أو كودين أم على الأقل للربط (مثل: 300, 400, 500)");
  }

  let suffixLength = 0;

  if (suffixMode === "AUTO") {
    const trailingZeroCounts = uniqueTokens.map((token) => {
      const match = token.match(/0+$/);
      return match ? match[0].length : 0;
    });
    suffixLength = Math.min(...trailingZeroCounts);
  } else {
    suffixLength = parseInt(suffixMode, 10) || 0;
  }

  const prefixes = uniqueTokens.map((token) => {
    if (suffixLength === 0) return token;
    if (token.length <= suffixLength) {
      throw new Error(
        `الكود "${token}" أقصر من عدد الخانات المتغيرة (${suffixLength}). اختر عدد خانات أقل أو تطابق حرفي.`
      );
    }
    return token.slice(0, token.length - suffixLength);
  });

  const uniquePrefixes = Array.from(new Set(prefixes));
  if (uniquePrefixes.length < 2) {
    throw new Error("يجب أن تختلف البادئات بين المراحل للربط");
  }

  return {
    tokens: uniqueTokens,
    prefixes: uniquePrefixes,
    suffixLength,
  };
}

export function parsePrefixesJson(prefixesStr: string): string[] {
  try {
    const parsed = JSON.parse(prefixesStr);
    return Array.isArray(parsed) ? parsed.map((p) => String(p)) : [];
  } catch {
    return [];
  }
}

/**
 * استخراج اللاحقة المطابقة لقاعدة ربط معينة من كود موديل
 */
export function extractRuleMatch(
  modelNo: string,
  prefixes: string[],
  suffixLength: number
): { prefix: string; suffix: string; siblingModels: string[] } | null {
  const cleanModel = modelNo.trim();
  const lowerModel = cleanModel.toLowerCase();

  for (const prefix of prefixes) {
    const lowerPrefix = prefix.toLowerCase();
    if (!lowerModel.startsWith(lowerPrefix)) continue;

    const suffix = cleanModel.slice(prefix.length);
    if (suffixLength === 0 && suffix !== "") continue;
    if (suffixLength > 0 && suffix.length !== suffixLength) continue;

    // إذا كان الكود الأساسي ينتهي بأصفار رقمية، نتحقق أن اللاحقة ليست فارغة الطول وأنها بنفس النمط
    const siblingModels = prefixes.map((p) => `${p}${suffix}`);
    return { prefix, suffix, siblingModels };
  }

  return null;
}

/**
 * إرجاع كل الموديلات المرتبطة بموديل معين حسب القواعد الفعالة
 */
export function findLinkedModelsForModel(
  modelNo: string,
  rules: StoredImageLinkRule[]
): { siblingModels: string[]; fallbackAnyColor: boolean } {
  const siblingsSet = new Set<string>();
  let fallbackAnyColor = false;

  for (const rule of rules) {
    if (!rule.active) continue;
    const prefixes = parsePrefixesJson(rule.prefixes);
    const match = extractRuleMatch(modelNo, prefixes, rule.suffix_length);
    if (match) {
      match.siblingModels.forEach((m) => siblingsSet.add(m));
      if (rule.fallback_any_color) fallbackAnyColor = true;
    }
  }

  return {
    siblingModels: Array.from(siblingsSet),
    fallbackAnyColor,
  };
}

/**
 * مزامنة الصور بين كل الموديلات المرتبطة في جدول Product الموحد
 */
export async function syncAllImageLinkRules(
  prisma: Pick<PrismaClient, "image_link_rules" | "product">,
  options: { ruleId?: number; overwriteExisting?: boolean } = {}
) {
  const rules = await prisma.image_link_rules.findMany({
    where: options.ruleId
      ? { id: options.ruleId }
      : { active: true },
    orderBy: { id: "asc" },
  });

  if (rules.length === 0) {
    return { updatedCount: 0, groupsMatched: 0 };
  }

  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      modelNo: true,
      color: true,
      image: true,
    },
  });

  let updatedCount = 0;
  let groupsMatched = 0;
  const overwriteExisting = Boolean(options.overwriteExisting);

  for (const rule of rules) {
    const prefixes = parsePrefixesJson(rule.prefixes);
    if (prefixes.length < 2) continue;

    // تجميع كل صفوف المنتجات حسب اللاحقة المشتركة (مثلاً "25" تجمع 3725 و 4725 و 5725)
    const bucketsBySuffix = new Map<string, typeof allProducts>();

    for (const prod of allProducts) {
      const match = extractRuleMatch(prod.modelNo, prefixes, rule.suffix_length);
      if (!match) continue;

      const suffixKey = match.suffix.toLowerCase();
      if (!bucketsBySuffix.has(suffixKey)) {
        bucketsBySuffix.set(suffixKey, []);
      }
      bucketsBySuffix.get(suffixKey)!.push(prod);
    }

    for (const bucket of bucketsBySuffix.values()) {
      // تأكد أن المجموعة تحتوي على موديلين مختلفين على الأقل
      const distinctModels = new Set(
        bucket.map((p) => p.modelNo.trim().toLowerCase())
      );
      if (distinctModels.size < 2) continue;

      groupsMatched++;

      // 1. البحث عن صورة متوفرة لكل لون داخل المجموعة
      const imageByColor = new Map<string, string>();
      let firstAvailableImage: string | null = null;

      for (const p of bucket) {
        const img = p.image?.trim();
        if (img) {
          if (!firstAvailableImage) firstAvailableImage = img;
          const colorKey = normalizeColorToken(p.color);
          if (!imageByColor.has(colorKey)) {
            imageByColor.set(colorKey, img);
          }
        }
      }

      if (!firstAvailableImage) continue;

      // 2. توزيع رابط الصورة على الموديلات المرتبطة التي ينقصها صورة (أو الكل إذا طلب overwrite)
      for (const p of bucket) {
        const hasImg = Boolean(p.image && p.image.trim() !== "");
        if (hasImg && !overwriteExisting) continue;

        const colorKey = normalizeColorToken(p.color);
        const targetImage =
          imageByColor.get(colorKey) ||
          (rule.fallback_any_color ? firstAvailableImage : null);

        if (targetImage && targetImage !== p.image) {
          await prisma.product.update({
            where: { id: p.id },
            data: { image: targetImage },
          });
          p.image = targetImage;
          updatedCount++;
        }
      }
    }
  }

  return { updatedCount, groupsMatched };
}