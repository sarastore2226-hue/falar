import { PrismaClient } from "@prisma/client";
import { normalizePublicImageUrl } from "./utils";

const prisma = new PrismaClient();

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

    // 2. جلب المنتجات من قاعدة البيانات
    // ✅ التعديل: حذفنا take: 1000 لجلب كل البيانات
    // ✅ حافظنا على شروط where لضمان أن يأتي "بناتي" فقط للبناتي
    const productsRaw = await prisma.products.findMany({
      where: {
        cur_qty: { gt: 0 }, // الكمية أكبر من صفر
        stor_id: 0, // المخزن الرئيسي

        // شروط البحث: نبحث عن اسم التصنيف في المجموعة أو النوع أو الاسم
        OR: [
          {
            group_name: { contains: currentCategory.name, mode: "insensitive" },
          },
          {
            kind_name: { contains: currentCategory.name, mode: "insensitive" },
          },
          {
            item_name: { contains: currentCategory.name, mode: "insensitive" },
          },
        ],
      },
      select: {
        unique_id: true,
        master_code: true,
        item_code: true,
        item_name: true,
        color: true,
        size: true,
        cur_qty: true,
        out_price: true,
        group_name: true,
        kind_name: true,
        images: true,
      },
      orderBy: { unique_id: "desc" }, // ترتيب بالأحدث
    });

    console.log(
      `📦 تم جلب ${productsRaw.length} سجل لتصنيف: ${currentCategory.name}`
    );

    // 3. تجميع المنتجات (نفس منطقك الأصلي الممتاز لتجميع الألوان والمقاسات)
    const groupedByMasterCode: { [key: string]: any } = {};

    productsRaw.forEach((row) => {
      const masterCode = row.master_code;
      if (!masterCode) return;

      const color = row.color || "افتراضي";
      const size = row.size || null;
      const curQty = Number(row.cur_qty) || 0;
      // نستخدم item_code كمرجع، وإذا لم يوجد نستخدم master_code
      const itemCode = row.item_code || masterCode;

      if (!groupedByMasterCode[masterCode]) {
        groupedByMasterCode[masterCode] = {
          modelId: masterCode,
          master_code: masterCode,
          price: row.out_price || 0,
          // نجمع الأسماء لضمان دقة الفلترة لاحقاً
          category: row.group_name || row.kind_name || "",
          description: row.item_name || row.kind_name || "منتج بدون وصف",
          group_name: row.group_name || "",
          kind_name: row.kind_name || "",
          item_name: row.item_name || "",
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

        if (row.images) {
          const img = row.images.trim();
          if (img.length > 10 && img !== "null") {
            imageUrl = normalizePublicImageUrl(img) || imageUrl;
          }
        }

        variant = {
          id: row.unique_id,
          color: color,
          imageUrl: imageUrl,
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

    // 4. فلترة نهائية (احتياطية) للتأكد من أن المنتج يخص التصنيف فعلاً
    // هذه الخطوة تضمن عدم دخول منتجات بالخطأ إذا كان البحث واسعاً جداً
    const filteredProducts = finalProducts.filter((p) => {
      const searchText = currentCategory.name.toLowerCase().trim();
      const groupName = (p.group_name || "").toLowerCase();
      const kindName = (p.kind_name || "").toLowerCase();
      const itemName = (p.item_name || "").toLowerCase();

      // يجب أن يحتوي أحد الحقول على اسم التصنيف
      return (
        groupName.includes(searchText) ||
        kindName.includes(searchText) ||
        itemName.includes(searchText)
      );
    });

    console.log(
      `🎯 العدد النهائي للموديلات في ${currentCategory.name}: ${filteredProducts.length}`
    );

    // إرجاع البيانات بنفس الهيكل المطلوب
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
