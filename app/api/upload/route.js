import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { findLinkedModelsForModel, normalizeColorToken } from "@/lib/image-linking";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "matgar1";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

function normalizeFileToken(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[*?:/\\|<>"]/g, "_");
}

// ✅ POST: رفع صورة جديدة وربطها بجدول Product الموحد + الموديلات المرتبطة بقواعد الربط
export async function POST(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file");
    const applyToAllColors = formData.get("applyToAllColors") === "true";
    const targetModelNo = String(formData.get("targetModelNo") || "").trim();

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "لم يتم اختيار أي ملف" },
        { status: 400 }
      );
    }

    const activeLinkRules = await prisma.image_link_rules.findMany({
      where: { active: true },
    });

    const results = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        const originalName = file.name;
        const lastDotIndex = originalName.lastIndexOf(".");
        const itemCodeFromFileName = (
          lastDotIndex !== -1
            ? originalName.substring(0, lastDotIndex)
            : originalName
        ).trim();

        const safeFileName = originalName
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9.\-_]/g, "");
        const fileBaseName = safeFileName.replace(/\.[^.]+$/, "") || uuidv4();
        const imageBaseKey = `${uuidv4()}-${fileBaseName}`;
        const imageSizes = [320, 660, 1024];

        await Promise.all(
          imageSizes.map(async (size) => {
            const optimizedBuffer = await sharp(buffer)
              .rotate()
              .resize({ width: size, withoutEnlargement: true })
              .webp({ quality: 82 })
              .toBuffer();

            await r2.send(
              new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: `${imageBaseKey}-${size}.webp`,
                Body: optimizedBuffer,
                ContentType: "image/webp",
                CacheControl: "public, max-age=31536000, immutable",
              })
            );
          })
        );

        const imageUrl = `${R2_PUBLIC_URL}/${imageBaseKey}-660.webp`;

        let whereCondition = null;
        let matchedProduct = null;

        if (applyToAllColors) {
          const modelCandidates = [
            targetModelNo,
            itemCodeFromFileName,
            itemCodeFromFileName.split(/[#\-_\s]/)[0],
          ].filter(Boolean);

          for (const candidate of modelCandidates) {
            const foundByModel = await prisma.product.findFirst({
              where: {
                modelNo: { equals: candidate.trim(), mode: "insensitive" },
              },
            });
            if (foundByModel) {
              matchedProduct = foundByModel;
              whereCondition = { modelNo: foundByModel.modelNo };
              break;
            }
          }
        } else {
          const modelColorPairs = [];
          const splitPairsRaw = [];
          for (let i = 0; i < itemCodeFromFileName.length; i++) {
            if (itemCodeFromFileName[i] === "-") {
              const m = itemCodeFromFileName.slice(0, i).trim();
              const c = itemCodeFromFileName.slice(i + 1).trim();
              if (m && c) {
                splitPairsRaw.push({ m, c });
                modelColorPairs.push({
                  modelNo: { equals: m, mode: "insensitive" },
                  color: { equals: c, mode: "insensitive" },
                });
              }
            }
          }

          matchedProduct = await prisma.product.findFirst({
            where: {
              OR: [
                ...modelColorPairs,
                {
                  material: {
                    equals: itemCodeFromFileName,
                    mode: "insensitive",
                  },
                },
                { id: itemCodeFromFileName },
              ],
            },
          });

          if (!matchedProduct && splitPairsRaw.length > 0) {
            const candidateModels = await prisma.product.findMany({
              where: {
                OR: splitPairsRaw.map((p) => ({
                  modelNo: { equals: p.m, mode: "insensitive" },
                })),
              },
            });

            matchedProduct =
              candidateModels.find((prod) =>
                splitPairsRaw.some(
                  (pair) =>
                    prod.modelNo.trim().toLowerCase() ===
                      pair.m.toLowerCase() &&
                    normalizeFileToken(prod.color) ===
                      normalizeFileToken(pair.c)
                )
              ) || null;
          }

          if (matchedProduct) {
            whereCondition = {
              modelNo: matchedProduct.modelNo,
              color: matchedProduct.color,
            };
          } else {
            const byModel = await prisma.product.findFirst({
              where: {
                modelNo: { equals: itemCodeFromFileName, mode: "insensitive" },
              },
            });

            if (byModel) {
              matchedProduct = byModel;
              whereCondition = { modelNo: byModel.modelNo };
            }
          }
        }

        let productInfo = null;
        let message = "✅ تم رفع الصورة (لم يتم العثور على منتج مطابق)";

        if (whereCondition && matchedProduct) {
          const previousImageUrl = matchedProduct.image || null;

          const updateResult = await prisma.product.updateMany({
            where: whereCondition,
            data: { image: imageUrl },
          });

          let totalUpdated = updateResult.count;
          const linkedAppliedModels = [];

          // تطبيق قواعد ربط المراحل تلقائياً على الموديلات الشقيقة
          if (activeLinkRules.length > 0) {
            const { siblingModels, fallbackAnyColor } = findLinkedModelsForModel(
              matchedProduct.modelNo,
              activeLinkRules
            );

            const otherSiblings = siblingModels.filter(
              (m) => m.toLowerCase() !== matchedProduct.modelNo.toLowerCase()
            );

            if (otherSiblings.length > 0) {
              const siblingRows = await prisma.product.findMany({
                where: {
                  OR: otherSiblings.map((m) => ({
                    modelNo: { equals: m, mode: "insensitive" },
                  })),
                },
                select: { id: true, modelNo: true, color: true, image: true },
              });

              const targetColorNorm = whereCondition.color
                ? normalizeColorToken(whereCondition.color)
                : null;

              const idsToUpdate = [];
              for (const row of siblingRows) {
                const canOverwrite =
                  !row.image ||
                  row.image.trim() === "" ||
                  (previousImageUrl && row.image === previousImageUrl);
                if (!canOverwrite) continue;

                const isColorMatch =
                  !targetColorNorm ||
                  fallbackAnyColor ||
                  normalizeColorToken(row.color) === targetColorNorm;

                if (isColorMatch) {
                  idsToUpdate.push(row.id);
                  if (!linkedAppliedModels.includes(row.modelNo)) {
                    linkedAppliedModels.push(row.modelNo);
                  }
                }
              }

              if (idsToUpdate.length > 0) {
                const linkedRes = await prisma.product.updateMany({
                  where: { id: { in: idsToUpdate } },
                  data: { image: imageUrl },
                });
                totalUpdated += linkedRes.count;
              }
            }
          }

          productInfo = {
            code: whereCondition.color
              ? `${matchedProduct.modelNo}-${matchedProduct.color}`
              : matchedProduct.modelNo,
            name: matchedProduct.description,
            color: whereCondition.color ? matchedProduct.color : "كل الألوان",
            master: matchedProduct.modelNo,
          };

          message =
            linkedAppliedModels.length > 0
              ? `✅ تم رفع الصورة وتطبيقها على ${totalUpdated} صنف (شاملاً الموديلات المرتبطة: ${linkedAppliedModels.join(", ")})`
              : `✅ تم رفع الصورة وتطبيقها على ${totalUpdated} صنف`;
        }

        // تحديث احتياطي في الجدول القديم products إن وجد
        try {
          const legacyProduct = await prisma.products.findFirst({
            where: {
              OR: [
                { item_code: itemCodeFromFileName },
                { master_code: itemCodeFromFileName },
              ],
            },
          });

          if (legacyProduct) {
            const legacyWhere = legacyProduct.master_code
              ? {
                  master_code: legacyProduct.master_code,
                  ...(!applyToAllColors && legacyProduct.color
                    ? { color: legacyProduct.color }
                    : {}),
                }
              : {
                  OR: [
                    { item_code: itemCodeFromFileName },
                    { master_code: itemCodeFromFileName },
                  ],
                };

            await prisma.products.updateMany({
              where: legacyWhere,
              data: { images: imageUrl },
            });
          }
        } catch {
          // تجاهل
        }

        results.push({
          fileName: originalName,
          success: true,
          message: message,
          imageUrl: imageUrl,
          product: productInfo,
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        results.push({
          fileName: file.name,
          success: false,
          error: fileError.message,
        });
      }
    }

    if (files.length === 1) {
      return NextResponse.json({
        success: results[0].success,
        message: results[0].message,
        image: { url: results[0].imageUrl },
        product: results[0].product,
        error: results[0].error,
      });
    }

    return NextResponse.json({
      success: true,
      message: `تمت معالجة ${files.length} ملف`,
      results: results,
    });
  } catch (error) {
    console.error("Global Upload Error:", error);
    return NextResponse.json(
      { success: false, error: "فشل في عملية الرفع: " + error.message },
      { status: 500 }
    );
  }
}

// ✅ DELETE: حذف صورة من R2 ومن جدول Product الموحد
export async function DELETE(request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "رابط الصورة مطلوب" },
        { status: 400 }
      );
    }

    let fileKey = imageUrl;
    if (imageUrl.startsWith("http")) {
      const urlParts = imageUrl.split("/");
      fileKey = urlParts[urlParts.length - 1];
    }

    try {
      const variantMatch = fileKey.match(/^(.*)-(320|660|1024)\.webp$/i);
      const fileKeys = variantMatch
        ? [320, 660, 1024].map((size) => `${variantMatch[1]}-${size}.webp`)
        : [fileKey];

      await Promise.all(
        fileKeys.map((key) =>
          r2.send(
            new DeleteObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: key,
            })
          )
        )
      );
    } catch (r2Error) {
      console.error("⚠️ خطأ في حذف الملف من R2:", r2Error.message);
    }

    const updateResult = await prisma.product.updateMany({
      where: { image: imageUrl },
      data: { image: null },
    });

    try {
      await prisma.products.updateMany({
        where: { images: imageUrl },
        data: { images: "" },
      });
    } catch {
      // تجاهل
    }

    return NextResponse.json({
      success: true,
      message: `تم حذف الصورة وإزالتها من ${updateResult.count} منتج`,
    });
  } catch (error) {
    console.error("Delete Error:", error);
    return NextResponse.json(
      { success: false, error: "فشل في عملية الحذف: " + error.message },
      { status: 500 }
    );
  }
}