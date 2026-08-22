import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "لم يتم اختيار أي ملف" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const optimizedBuffer = await sharp(buffer)
      .rotate()
      .webp({ quality: 82 })
      .toBuffer();

    const safeFileName = file.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "");
    const fileBaseName = safeFileName.replace(/\.[^.]+$/, "") || "category";
    const r2Key = `${uuidv4()}-${fileBaseName}.webp`;

    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: optimizedBuffer,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    });

    await r2.send(uploadCommand);

    const imageUrl = `${R2_PUBLIC_URL}/${r2Key}`;

    return NextResponse.json({
      success: true,
      message: "تم رفع الصورة بنجاح",
      image: { url: imageUrl },
    });
  } catch (error) {
    console.error("Category Upload Error:", error);
    return NextResponse.json(
      { success: false, error: "فشل في عملية الرفع: " + error.message },
      { status: 500 }
    );
  }
}
