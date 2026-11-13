import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

// 🔥 إعداد اتصال R2 Cloudflare
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

// ✅ POST: رفع صورة جديدة وربطها بجدول Product الموحد
export async function POST(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file");

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "لم يتم اختيار أي ملف" },
        { status: 400 }
      );
    }

    const results = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        const originalName = file.name;
        const lastDotIndex = originalName.lastIndexOf(".");
        // استخراج الكود من اسم الملف (إزالة الامتداد)
        const itemCodeFromFileName = (
          lastDotIndex !== -1
            ? originalName.substring(0, lastDotIndex)
            : originalName
        ).trim();

        // تنظيف اسم الملف للرفع على R2
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

        // نخزن نسخة 660 كالرابط الأساسي، وتُشتق منه بقية الأحجام في الواجهة.
        const imageUrl = `${R2_PUBLIC_URL}/${imageBaseKey}-660.webp`;

        // 1. بناء احتمالات المطابقة من اسم الملف (مثلاً: 3700-أسود)
        const modelColorPairs = [];
        for (let i = 0; i < itemCodeFromFileName.length; i++) {
          if (itemCodeFromFileName[i] === "-") {
            const m = itemCodeFromFileName.slice(0, i).trim();
            const c = itemCodeFromFileName.slice(i + 1).trim();
            if (m && c) {
              modelColorPairs.push({
                modelNo: { equals: m, mode: "insensitive" },
                color: { equals: c, mode: "insensitive" },
              });
            }
          }
        }

        // البحث في الجدول الموحد Product (باللون المحدد أو material أو id)
        let whereCondition = null;
        let matchedProduct = await prisma.product.findFirst({
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

        if (matchedProduct) {
          whereCondition = {
            modelNo: matchedProduct.modelNo,
            color: matchedProduct.color,
          };
        } else {
          // إذا رُفعت الصورة باسم الموديل فقط (مثل 3700.jpg) تُطبق على كل ألوان الموديل
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

        let productInfo = null;
        let message = "✅ تم رفع الصورة (لم يتم العثور على منتج مطابق)";

        if (whereCondition) {
          const updateResult = await prisma.product.updateMany({
            where: whereCondition,
            data: { image: imageUrl },
          });

          productInfo = {
            code: `${matchedProduct.modelNo}-${matchedProduct.color}`,
            name: matchedProduct.description,
            color: matchedProduct.color,
            master: matchedProduct.modelNo,
          };

          message = `✅ تم رفع الصورة وتطبيقها على ${updateResult.count} صنف`;
        }

        // تحديث احتياطي في الجدول القديم products إن وجد صف مطابق
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
                  ...(legacyProduct.color ? { color: legacyProduct.color } : {}),
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
          // تجاهل أي خطأ في الجدول القديم
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

    console.log("🗑️ جاري حذف الصورة:", imageUrl);

    // 1. استخراج مفتاح الملف (Key) من الرابط
    let fileKey = imageUrl;
    if (imageUrl.startsWith("http")) {
      const urlParts = imageUrl.split("/");
      fileKey = urlParts[urlParts.length - 1];
    }

    // 2. الحذف من Cloudflare R2
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
      console.log("✅ تم حذف نسخ الصورة من R2:", fileKeys);
    } catch (r2Error) {
      console.error(
        "⚠️ خطأ في حذف الملف من R2 (قد يكون غير موجود):",
        r2Error.message
      );
    }

    // 3. حذف الرابط من جدول Product الموحد
    const updateResult = await prisma.product.updateMany({
      where: { image: imageUrl },
      data: { image: null },
    });

    // حذف احتياطي من الجدول القديم products إن وجد
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