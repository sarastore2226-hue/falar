import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

const prisma = new PrismaClient();

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
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// ✅ POST: رفع صورة جديدة
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
        // استخراج الكود من اسم الملف (إزالة الامتداد)
        const itemCodeFromFileName = originalName.substring(
          0,
          originalName.lastIndexOf(".")
        );

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

        // 1. البحث عن المنتج المطابق لتحديث صورته
        const product = await prisma.products.findFirst({
          where: {
            OR: [
              { item_code: itemCodeFromFileName },
              { master_code: itemCodeFromFileName },
            ],
          },
        });

        let productInfo = null;
        let message = "✅ تم رفع الصورة (لم يتم العثور على منتج مطابق)";

        if (product) {
          let whereCondition = {};

          if (product.master_code) {
            whereCondition = {
              master_code: product.master_code,
              ...(product.color ? { color: product.color } : {}),
            };
          } else {
            whereCondition = {
              OR: [
                { item_code: itemCodeFromFileName },
                { master_code: itemCodeFromFileName },
              ],
            };
          }

          // تنفيذ التحديث الجماعي
          const updateResult = await prisma.products.updateMany({
            where: whereCondition,
            data: { images: imageUrl },
          });

          productInfo = {
            code: product.item_code || product.master_code,
            name: product.item_name,
            color: product.color,
            master: product.master_code,
          };

          message = `✅ تم رفع الصورة وتطبيقها على ${updateResult.count} منتج/مقاس`;
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

// ✅ DELETE: حذف صورة
export async function DELETE(request) {
  try {
    const { imageUrl, productId } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "رابط الصورة مطلوب" },
        { status: 400 }
      );
    }

    console.log("🗑️ جاري حذف الصورة:", imageUrl);

    // 1. استخراج مفتاح الملف (Key) من الرابط
    // الرابط يكون عادة: https://pub-xxx.r2.dev/KEY-NAME
    // نحتاج لاستخراج الجزء بعد الدومين
    let fileKey = imageUrl;
    if (imageUrl.startsWith("http")) {
      const urlParts = imageUrl.split("/");
      // نأخذ آخر جزء (اسم الملف) أو المسار النسبي إذا كان داخل مجلدات
      // في الـ POST أعلاه، نحن نرفع مباشرة للروت، لذا اسم الملف يكفي
      fileKey = urlParts[urlParts.length - 1];

      // إذا كان لديك هيكلية مجلدات، يفضل استخدام:
      // fileKey = imageUrl.replace(`${R2_PUBLIC_URL}/`, '');
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
      // نكمل العملية لحذف الرابط من قاعدة البيانات حتى لو فشل حذف الملف
    }

    // 3. حذف الرابط من قاعدة البيانات
    // نقوم بتصفير حقل الصور للمنتجات التي تحتوي على هذا الرابط
    const updateResult = await prisma.products.updateMany({
      where: { images: imageUrl },
      data: { images: "" }, // أو null حسب تصميم قاعدة البيانات
    });

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
