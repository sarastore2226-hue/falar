import { NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

// جمع كل روابط الصور المستخدمة فعلياً من قاعدة البيانات
async function getUsedImageKeys() {
  const usedKeys = new Set();

  const products = await prisma.products.findMany({
    where: { images: { not: null } },
    select: { images: true },
  });

  const categories = await prisma.categories.findMany({
    where: { image: { not: null } },
    select: { image: true },
  });

  const companies = await prisma.company_info.findMany({
    select: { logo: true },
  });

  const allUrls = [
    ...products.map((p) => p.images),
    ...categories.map((c) => c.image),
    ...companies.map((c) => c.logo),
  ];

  for (const url of allUrls) {
    if (!url) continue;
    const urls = url.split(",").map((u) => u.trim());
    for (const singleUrl of urls) {
      if (!singleUrl) continue;
      if (singleUrl.startsWith(R2_PUBLIC_URL)) {
        usedKeys.add(singleUrl.replace(`${R2_PUBLIC_URL}/`, ""));
      }
    }
  }

  return usedKeys;
}

// سرد كل الكائنات في المستودع (مع التعامل مع التقسيم)
async function listAllObjects() {
  const objects = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
    });
    const response = await r2.send(command);

    if (response.Contents) {
      objects.push(...response.Contents);
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}

export async function POST() {
  try {
    // 1. سرد كل الصور في المستودع
    const allObjects = await listAllObjects();

    if (allObjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: "المستودع فارغ بالفعل",
        report: { total: 0, deleted: 0, kept: 0 },
      });
    }

    // 2. جمع الصور المستخدمة من قاعدة البيانات
    const usedKeys = await getUsedImageKeys();

    // 3. حساب الصور اليتيمة (غير المستخدمة)
    const orphanKeys = allObjects
      .map((obj) => obj.Key)
      .filter((key) => key && !usedKeys.has(key));

    // 4. الحذف الجماعي على دفعات (1000 لكل طلب)
    let deletedCount = 0;
    for (let i = 0; i < orphanKeys.length; i += 1000) {
      const batch = orphanKeys.slice(i, i + 1000);
      if (batch.length === 0) continue;

      const deleteCommand = new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      });

      const result = await r2.send(deleteCommand);
      const errors = result.Errors || [];
      const succeeded = batch.length - errors.length;
      deletedCount += succeeded;

      if (errors.length > 0) {
        console.error("Cleanup delete errors:", errors);
      }
    }

    const keptCount = allObjects.length - orphanKeys.length;

    return NextResponse.json({
      success: true,
      message:
        deletedCount > 0
          ? `تم حذف ${deletedCount} صورة يتيمة بنجاح`
          : "لا توجد صور يتيمة - كل الصور مستخدمة",
      report: {
        total: allObjects.length,
        deleted: deletedCount,
        kept: keptCount,
      },
    });
  } catch (error) {
    console.error("Cleanup Error:", error);
    return NextResponse.json(
      { success: false, error: "فشل في تنظيف الصور: " + error.message },
      { status: 500 }
    );
  }
}
