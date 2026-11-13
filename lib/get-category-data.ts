import { PrismaClient } from "@prisma/client";
import { normalizePublicImageUrl } from "./utils";

const prisma = new PrismaClient();

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://images.vooy.shop";

export async function getCategoryData(categoryId: string) {
  try {
    const id = parseInt(categoryId);

    // 1. جلب كل التصنيفات لتحديد التصنيف الحالي والفرعي
    const categories = await prisma.categories.findMany({
      select: {
        id: true,
        name: true,
        kind: true,
        image: true,
        sub: true,
      },
    });

    // البحث عن التصنيف الحالي
    const currentCategory = categories.find((cat) => cat.id === id);

    if (!currentCategory) {
      return {
        products: [],
        categories: [],
        currentCategory: null,
        subCategories: [],
      };
    }

    // جلب التصنيفات الفرعية التابعة لهذا التصنيف (مثلاً: بناتي -> فساتين، أطقم...)
    const normalizedCategories = categories.map((category) => ({
      ...category,
      image: normalizePublicImageUrl(category.image),
    }));

    const normalizedCurrentCategory = normalizedCategories.find(
      (category) => category.id === id
    );

    const subCategories = normalizedCategories.filter(
      (cat) => cat.sub === currentCategory.name && cat.image
    );

    // 2. جلب المنتجات من جدول Product المعتمد (المعرض)
    // نبحث عن اسم التصنيف في الجروب أو النوع أو الخامة أو الوصف
    const productsRaw = await prisma.product.findMany({
      where: {
        OR: [
          { status: "OPEN" },
          { currentStock: { gt: 0 } },
        ],
        AND: [
          {
            OR: [
              {
                group_name: { contains: currentCategory.name, mode: "insensitive" },
              },
              {
                kind_name: { contains: currentCategory.name, mode: "insensitive" },
              },
              {
                material: { contains: currentCategory.name, mode: "insensitive" },
              },
              {
                description: { contains: currentCategory.name, mode: "insensitive" },
              },
              {
                modelNo: { contains: currentCategory.name, mode: "insensitive" },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        modelNo: true,
        description: true,
        material: true,
        color: true,
        stockQty: true,
        currentStock: true,
        price: true,
        group_name: true,
        kind_name: true,
        image: true,
      },
      orderBy: { id: "desc" }, // ترتيب بالأحدث
    });

    console.log(
      `📦 تم جلب ${productsRaw.length} سجل لتصنيف: ${currentCategory.name}`
    );

    // 3. تجميع المنتجات (نفس منطقك الأصلي الممتاز لتجميع الألوان والمقاسات)
    const groupedByMasterCode: { [key: string]: any } = {};

    productsRaw.forEach((row) => {
      const masterCode = row.modelNo;
      if (!masterCode) return;

      const color = row.color || "افتراضي";
      const size = "ONE SIZE"; // المقاس الافتراضي لبيع الجملة
      const curQty = Number(row.currentStock) || 0;
      const itemCode = `${row.modelNo}-${color}`;

      if (!groupedByMasterCode[masterCode]) {
        groupedByMasterCode[masterCode] = {
          modelId: masterCode,
          master_code: masterCode,
          price: row.price || 0,
          // نجمع الأسماء لضمان دقة الفلترة لاحقاً
          category: row.group_name || row.kind_name || row.material || "",
          description: row.description || row.kind_name || `موديل ${masterCode}`,
          group_name: row.group_name || "",
          kind_name: row.kind_name || "",
          item_name: row.description || `موديل ${masterCode}`,
          item_code: itemCode,
          cur_qty: 0,
          variants: [],
        };
      }

      let variant = groupedByMasterCode[masterCode].variants.find(
        (v: any) => v.color === color
      );

      if (!variant) {
        // معالجة الصورة بشكل آمن
        let imageUrl =
          "https://via.placeholder.com/500x700/EFEFEF/666666?text=No+Image";

        if (row.image && row.image.trim().length > 10 && row.image !== "null") {
          imageUrl = normalizePublicImageUrl(row.image.trim()) || imageUrl;
        } else {
          // جلب الصورة التلقائية من مسار R2 باسم (كود الموديل - اللون)
          imageUrl = `${R2_PUBLIC_URL}/${masterCode}-${color}.webp`;
        }

        variant = {
          id: row.id,
          color: color,
          imageUrl: imageUrl,
          itemCode: itemCode,
          material: row.material || "",
          sizes: [],
          cur_qty: curQty,
          sizeQuantities: {},
        };
        groupedByMasterCode[masterCode].variants.push(variant);
      } else {
        variant.cur_qty += curQty;
      }

      groupedByMasterCode[masterCode].cur_qty += curQty;

      if (size) {
        if (!variant.sizes.includes(size)) {
          variant.sizes.push(size);
        }
        variant.sizeQuantities = variant.sizeQuantities || {};
        variant.sizeQuantities[size] =
          (variant.sizeQuantities[size] || 0) + curQty;
      }
    });

    const finalProducts = Object.values(groupedByMasterCode);

    // 4. فلترة نهائية (احتياطية صارمة) للتأكد من أن المنتج يخص التصنيف فعلاً
    // هذه الخطوة تضمن عدم دخول منتجات بالخطأ إذا كان استعلام قاعدة البيانات واسعاً
    const filteredProducts = finalProducts.filter((p) => {
      const searchText = currentCategory.name.toLowerCase().trim();
      const groupName = (p.group_name || "").toLowerCase();
      const kindName = (p.kind_name || "").toLowerCase();
      const itemName = (p.item_name || "").toLowerCase();
      const material = (p.material || "").toLowerCase();
      const description = (p.description || "").toLowerCase();
      const modelNo = (p.master_code || "").toLowerCase();

      // يجب أن يحتوي أحد الحقول على اسم التصنيف
      return (
        groupName.includes(searchText) ||
        kindName.includes(searchText) ||
        itemName.includes(searchText) ||
        material.includes(searchText) ||
        description.includes(searchText) ||
        modelNo.includes(searchText)
      );
    });

    console.log(
      `🎯 العدد النهائي للموديلات في ${currentCategory.name}: ${filteredProducts.length}`
    );

    // إرجاع البيانات بنفس الهيكل المطلوب بالضبط
    return JSON.parse(
      JSON.stringify({
        products: filteredProducts,
        categories: normalizedCategories,
        currentCategory: normalizedCurrentCategory,
        subCategories,
      })
    );
  } catch (error) {
    console.error("Category Data Error:", error);
    return {
      products: [],
      categories: [],
      currentCategory: null,
      subCategories: [],
    };
  }
}