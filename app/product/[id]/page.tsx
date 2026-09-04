"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/components/Header";
import ProductCard from "@/app/components/ProductCard";
import PromotionNotice from "@/app/components/PromotionNotice";
import { useCart } from "../../../context/CartContext";

interface Product {
  modelId: string;
  id?: string | number;
  price: number;
  category: string;
  description: string;
  master_code?: string;
  item_code?: string;
  image?: string;
  imageUrl?: string;
  variants: Array<{
    id: string;
    color: string;
    imageUrl: string;
    sizes: string[];
    cur_qty?: number;
    stor_id?: number;
    itemCode?: string;
    sizeQuantities?: { [size: string]: number };
    sizeItemCodes?: { [size: string]: string };
    sizePrices?: { [size: string]: number };
    totalColorQuantity?: number;
  }>;
  cur_qty?: number;
  stor_id?: number;
}

export default function ProductDetail() {
  const params = useParams();
  const productId = params.id as string;
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentItemCode, setCurrentItemCode] = useState<string>("");
  const [whatsappNumber, setWhatsappNumber] = useState<string>("");
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });

  const isEmployee = () => {
    try {
      const employee = localStorage.getItem("employee");
      const employeeToken = localStorage.getItem("employeeToken");
      return !!(employee && employeeToken);
    } catch (error) {
      return false;
    }
  };

  const employee = isEmployee();

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const response = await fetch("/api/company");
        if (response.ok) {
          const data = await response.json();
          const phone = data.phone1 || data.phone2 || "201234567890";
          setWhatsappNumber(phone);
        }
      } catch (error) {
        console.error("Error fetching company info:", error);
      }
    };

    fetchCompanyInfo();
  }, []);

  // دالة مطابقة مرنة للتحقق من المنتج
  const isProductMatch = (p: any, searchId: string) => {
    if (!p) return false;
    const searchStr = String(searchId).trim().toLowerCase();

    const idMatch = p.id && String(p.id) === searchId;
    const modelMatch =
      p.modelId && String(p.modelId).toLowerCase() === searchStr;
    const masterMatch =
      p.master_code && String(p.master_code).toLowerCase() === searchStr;
    const itemMatch =
      p.item_code && String(p.item_code).toLowerCase() === searchStr;

    return idMatch || modelMatch || masterMatch || itemMatch;
  };

  const processVariants = (
    variants: any[],
    masterCode?: string,
    modelId?: string
  ) => {
    if (!variants || variants.length === 0) return [];

    let processed = [...variants].sort((a, b) => Number(a.id) - Number(b.id));

    if (masterCode && masterCode.length > 2) {
      processed = processed.filter((v) => {
        if (!v.itemCode) return true;
        const vCode = v.itemCode.toLowerCase();
        const mCode = masterCode.toLowerCase();
        const mid = modelId ? modelId.toLowerCase() : "";

        return vCode.includes(mCode) || (mid && vCode.includes(mid));
      });
    }

    return processed;
  };

  const fetchProductDetails = async () => {
    try {
      setLoading(true);

      let foundProduct: Product | undefined;
      let allProductsList: Product[] = [];

      // الخطوة 1: محاولة الجلب من القائمة العامة (للمنتجات الأولى)
      try {
        const endpoint = employee
          ? "/api/getAllData?employee=true"
          : "/api/getAllData";
        const response = await fetch(endpoint);

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.products) {
            allProductsList = data.products;
            foundProduct = allProductsList.find((p: any) =>
              isProductMatch(p, productId)
            );
          }
        }
      } catch (err) {
        console.warn("Using fallback fetch", err);
      }

      // الخطوة 2: تجربة البحث أولاً
      if (!foundProduct) {
        console.log("Try searching for product:", productId);
        try {
          const searchRes = await fetch(`/api/products?search=${productId}`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const list = searchData.products || [];
            foundProduct = list.find((p: any) => isProductMatch(p, productId));

            if (!foundProduct && list.length === 1) {
              const potential = list[0];
              if (
                String(potential.id) !== "3790" ||
                String(productId) === "3790"
              ) {
                foundProduct = potential;
              }
            }
          }
        } catch (e) {
          console.log("Search fetch error", e);
        }
      }

      // الخطوة 3: الجلب المباشر (مع إضافة employee=true)
      if (!foundProduct) {
        console.log("Try direct fetch for product:", productId);
        try {
          // ✅ تعديل هنا: إضافة employee=true إذا كان المستخدم موظفاً
          const url = employee
            ? `/api/products/${productId}?employee=true`
            : `/api/products/${productId}`;
          const directRes = await fetch(url);
          if (directRes.ok) {
            const directData = await directRes.json();
            const p = directData.product || directData;

            if (p) {
              if (isProductMatch(p, productId)) {
                foundProduct = p;
              } else if (String(p.id) !== "3790") {
                foundProduct = p;
              }
            }
          }
        } catch (e) {
          console.log("Direct fetch error", e);
        }
      }

      if (foundProduct) {
        foundProduct.variants = processVariants(
          foundProduct.variants,
          foundProduct.master_code,
          foundProduct.modelId
        );

        setProduct(foundProduct);

        let similar = [];
        if (allProductsList.length > 0 && foundProduct.category) {
          similar = allProductsList
            .filter(
              (p) =>
                p.category === foundProduct!.category &&
                String(p.modelId) !== String(foundProduct!.modelId)
            )
            .slice(0, 4);
        } else if (foundProduct.category) {
          try {
            const simRes = await fetch(
              `/api/products?category=${encodeURIComponent(
                foundProduct.category
              )}&limit=4`
            );
            if (simRes.ok) {
              const simData = await simRes.json();
              similar = (simData.products || []).filter(
                (p: any) => String(p.modelId) !== String(foundProduct!.modelId)
              );
            }
          } catch (e) {}
        }
        setSimilarProducts(similar);

        if (foundProduct.variants && foundProduct.variants.length > 0) {
          const firstVariant = foundProduct.variants[0];
          setSelectedColor(firstVariant.color);
          setCurrentItemCode(
            firstVariant.itemCode || foundProduct.item_code || ""
          );

          if (firstVariant.sizes && firstVariant.sizes.length > 0) {
            const firstSize = firstVariant.sizes[0];
            setSelectedSize(firstSize);
            updateItemCodeForSize(firstVariant, firstSize, foundProduct);
          }
        } else {
          setCurrentItemCode(foundProduct.item_code || "");
        }
      } else {
        setProduct(null);
      }
    } catch (error: any) {
      console.error("❌ Error in fetchProductDetails:", error);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const updateItemCodeForSize = (
    variant: any,
    size: string,
    prod: Product | null = product
  ) => {
    if (!variant) return;

    let newItemCode = "";
    if (variant.sizeItemCodes && variant.sizeItemCodes[size]) {
      newItemCode = variant.sizeItemCodes[size];
    } else if (variant.itemCode) {
      newItemCode = variant.itemCode;
    } else if (prod?.item_code) {
      newItemCode = prod.item_code;
    }

    if (newItemCode && newItemCode !== currentItemCode) {
      setCurrentItemCode(newItemCode);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchProductDetails();
    }
  }, [productId]);

  const selectedVariant = product?.variants?.find(
    (v) => v.color === selectedColor
  );

  const getTotalColorQuantity = (color: string) => {
    if (!employee) return 999;
    const variant = product?.variants?.find((v) => v.color === color);
    if (!variant) return 0;
    return variant.cur_qty || variant.totalColorQuantity || 0;
  };

  const getSizeQuantity = () => {
    if (!employee) return 999;
    if (!product?.variants || product.variants.length === 0) {
      return product?.cur_qty || 0;
    }
    if (!selectedVariant || !selectedSize) return 0;
    if (
      selectedVariant.sizeQuantities &&
      selectedVariant.sizeQuantities[selectedSize] !== undefined
    ) {
      return selectedVariant.sizeQuantities[selectedSize];
    }
    return selectedVariant.cur_qty || 0;
  };

  const currentSizeQuantity = getSizeQuantity();

  const selectedPrice =
    selectedVariant?.sizePrices?.[selectedSize] ?? product?.price ?? 0;

  const handleAddToCart = () => {
    if (!product) return;
    if (employee && currentSizeQuantity === 0) {
      alert("⛔ هذا المنتج غير متوفر حالياً في المخزن");
      return;
    }
    const finalColor =
      selectedColor || product.variants?.[0]?.color || "افتراضي";
    const finalSize = selectedSize || selectedVariant?.sizes?.[0] || "ONE SIZE";

    addToCart(product, finalColor, finalSize, quantity, selectedPrice);
    alert(`✅ تم إضافة "${product.description}" إلى السلة`);
  };

  const handleWhatsApp = () => {
    if (!product) return;
    const productCode = product.master_code || product.modelId;
    const availability = employee
      ? currentSizeQuantity > 0
        ? `متوفر: ${currentSizeQuantity} قطعة`
        : "غير متوفر"
      : "متوفر";

    const message = `السلام عليكم\nأريد الاستفسار عن المنتج:\n${
      product.description
    }\n\n📦 **معلومات المنتج:**\n- الكود: ${productCode}\n- كود المنتج: ${
      currentItemCode || "غير محدد"
    }\n- اللون: ${selectedColor || "غير محدد"}\n- المقاس: ${
      selectedSize || "غير محدد"
    }\n- السعر: ${product.price} ج.م\n- الحالة: ${availability}`;

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    const newVariant = product?.variants?.find((v) => v.color === color);
    if (newVariant) {
      setCurrentItemCode(newVariant.itemCode || product?.item_code || "");
      if (newVariant.sizes && newVariant.sizes.length > 0) {
        const firstSize = newVariant.sizes[0];
        setSelectedSize(firstSize);
        updateItemCodeForSize(newVariant, firstSize);
      } else {
        setSelectedSize("");
      }
    }
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    if (selectedVariant) {
      updateItemCodeForSize(selectedVariant, size);
    }
  };

  const getQuantityColor = (qty: number) => {
    if (qty === 0) return "bg-red-100 text-red-800 border-red-200";
    if (qty <= 5) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  const getQuantityText = (qty: number, size?: string) => {
    if (!employee) return "✅ متوفر";
    if (qty === 0) return "⛔ غير متوفر";
    if (qty <= 5) return `⚠️ آخر ${qty}`;
    if (size) return `✅ متوفر (${qty}) - ${size}`;
    return `✅ متوفر (${qty})`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">جاري تحميل المنتج...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">❌</div>
              <h2 className="text-xl font-medium text-gray-900 mb-2">
                المنتج غير موجود
              </h2>
              <button
                onClick={() => window.history.back()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                العودة للمنتجات
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getDisplayImage = () => {
    if (selectedVariant?.imageUrl) return selectedVariant.imageUrl;
    if (
      product.variants &&
      product.variants.length > 0 &&
      product.variants[0].imageUrl
    ) {
      return product.variants[0].imageUrl;
    }
    if (product.image) return product.image;
    if (product.imageUrl) return product.imageUrl;
    return "https://via.placeholder.com/600x800/EFEFEF/666666?text=No+Image";
  };

  const mainImage = getDisplayImage();
  const masterCode = product.master_code || product.modelId;

  const handleImageMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setZoomPosition({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => window.history.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5 ml-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          العودة للمنتجات
        </button>

        <div className="mb-4 flex justify-end">
          <div className="flex items-center gap-3">
            <span
              className={`text-xs sm:text-sm px-3 py-1.5 rounded-full font-medium ${
                employee
                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                  : "bg-green-100 text-green-800 border border-green-200"
              }`}
            >
              {employee ? "👔 وضع الموظف" : "👤 عميل"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            <div>
              <div
                className="group relative aspect-[3/4] cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                onMouseMove={handleImageMove}
                onMouseLeave={() => setZoomPosition({ x: 50, y: 50 })}
                onClick={() => setIsImageZoomOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setIsImageZoomOpen(true);
                  }
                }}
                aria-label="تكبير صورة المنتج"
              >
                <img
                  src={mainImage}
                  alt={product.description}
                  className="h-full w-full object-contain p-4 transition-transform duration-200 ease-out group-hover:scale-[1.8]"
                  style={{ transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%` }}
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://via.placeholder.com/600x800/EFEFEF/666666?text=No+Image";
                  }}
                />
                <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  مرر للتكبير · اضغط للعرض الكامل
                </div>
              </div>

              {product.variants && product.variants.length > 1 && (
                <div className="mt-4">
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => handleColorSelect(variant.color)}
                        title={variant.color}
                        className={`relative w-20 h-24 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                          selectedColor === variant.color
                            ? "border-blue-600 ring-2 ring-blue-100 opacity-100"
                            : "border-transparent border-gray-100 opacity-70 hover:opacity-100 hover:border-gray-300"
                        }`}
                      >
                        <img
                          src={variant.imageUrl}
                          alt={variant.color}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5 truncate backdrop-blur-sm">
                          {variant.color}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 mb-2">كود المنتج:</h4>
                <div className="flex items-center justify-between">
                  <code className="text-sm bg-white px-3 py-2 rounded border border-gray-300 font-mono">
                    {currentItemCode || "غير محدد"}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentItemCode);
                      alert("تم نسخ كود المنتج!");
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    نسخ
                  </button>
                </div>
              </div>

              {employee && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">ملاحظة للموظف:</span>
                    {currentSizeQuantity > 0
                      ? ` هذا المنتج متوفر (${currentSizeQuantity} قطعة)`
                      : " هذا المنتج غير متوفر حالياً في المخزن"}
                  </p>
                </div>
              )}
            </div>

            {isImageZoomOpen && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-label="صورة المنتج بالحجم الكامل"
                onClick={() => setIsImageZoomOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsImageZoomOpen(false)}
                  className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-2xl text-gray-800 shadow-lg transition hover:bg-white"
                  aria-label="إغلاق الصورة"
                >
                  ×
                </button>
                <img
                  src={mainImage}
                  alt={product.description}
                  className="max-h-[92vh] max-w-[94vw] rounded-lg object-contain shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {product.description}
                </h1>
                <p className="text-gray-600 mt-2">{product.category}</p>

                <div className="mt-4">
                  <PromotionNotice
                    category={product.category}
                    product={product.description}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-mono">
                    الكود: {masterCode}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-blue-600">
                  {selectedPrice.toLocaleString()} ج.م
                </span>

                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getQuantityColor(
                    currentSizeQuantity
                  )}`}
                >
                  {getQuantityText(currentSizeQuantity, selectedSize)}
                </span>
              </div>

              {product.variants && product.variants.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    اللون{" "}
                    {employee && (
                      <span className="text-sm text-gray-500">
                        (مع الكميات)
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {product.variants.map((variant) => {
                      const totalQty = getTotalColorQuantity(variant.color);
                      return (
                        <button
                          key={variant.id}
                          onClick={() => handleColorSelect(variant.color)}
                          className={`px-4 py-2 border-2 rounded-lg transition-colors flex flex-col items-center min-w-24 ${
                            selectedColor === variant.color
                              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                              : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                          }`}
                        >
                          <span className="font-medium">{variant.color}</span>
                          {employee && (
                            <span
                              className={`text-xs mt-1 px-2 py-0.5 rounded-full ${getQuantityColor(
                                totalQty
                              )}`}
                            >
                              {totalQty} قطعة
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedVariant?.sizes && selectedVariant.sizes.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    المقاس{" "}
                    {employee && (
                      <span className="text-sm text-gray-500">
                        (مع الكميات)
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {selectedVariant.sizes.map((size) => {
                      const sizeQty =
                        selectedVariant.sizeQuantities?.[size] ||
                        selectedVariant.cur_qty ||
                        0;
                      const displayQty = employee ? sizeQty : 999;

                      return (
                        <button
                          key={size}
                          onClick={() => handleSizeSelect(size)}
                          className={`px-4 py-2 border-2 rounded-lg transition-colors flex flex-col items-center min-w-24 ${
                            selectedSize === size
                              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                              : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                          }`}
                        >
                          <span className="font-medium">{size}</span>
                          {employee && (
                            <span
                              className={`text-xs mt-1 px-2 py-0.5 rounded-full ${getQuantityColor(
                                displayQty
                              )}`}
                            >
                              {displayQty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  الكمية
                </h3>
                <div className="flex items-center border border-gray-300 rounded-lg w-fit overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors border-r border-gray-300"
                    disabled={employee && currentSizeQuantity === 0}
                  >
                    -
                  </button>
                  <span className="px-4 py-2 min-w-12 text-center font-medium">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors border-l border-gray-300"
                    disabled={employee && quantity >= currentSizeQuantity}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleAddToCart}
                  disabled={employee && currentSizeQuantity === 0}
                  className={`py-3 px-6 rounded-lg transition-colors font-medium text-lg flex items-center justify-center space-x-2 space-x-reverse ${
                    employee && currentSizeQuantity === 0
                      ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span>
                    {employee && currentSizeQuantity === 0
                      ? "غير متوفر"
                      : "أضف إلى السلة"}
                  </span>
                </button>

                <button
                  onClick={handleWhatsApp}
                  className="bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg flex items-center justify-center space-x-2 space-x-reverse"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893c0-3.189-1.248-6.189-3.515-8.464" />
                  </svg>
                  <span>استفسر عبر الواتساب</span>
                </button>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  معلومات المنتج
                </h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• ضمان 30 يوم</li>
                  <li>• شحن مجاني للطلبات فوق 200 ج.م</li>
                  <li>• إرجاع خلال 14 يوم</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {similarProducts.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                منتجات مشابهة
              </h2>
              <p className="text-gray-600 mt-1">
                اكتشف منتجات أخرى من نفس التصنيف
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {similarProducts.map((similarProduct) => (
                <ProductCard
                  key={similarProduct.modelId}
                  product={similarProduct}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
