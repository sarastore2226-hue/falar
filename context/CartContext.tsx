"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface CartItem {
  id: string; // ✅ سيصبح ID فريد (modelId + color + size)
  name: string;
  price: number;
  color: string;
  size: string;
  quantity: number;
  image: string;
  item_code?: string;
  master_code?: string;
  category?: string;
  modelId?: string; // ✅ حفظ modelId الأصلي
  maxQuantity?: number;
}

interface Product {
  modelId: string;
  price: number;
  category: string;
  description: string;
  group_name?: string;
  kind_name?: string;
  item_name?: string;
  master_code?: string;
  variants: Array<{
    id: string;
    color: string;
    imageUrl: string;
    sizes: string[];
    itemCode?: string;
    sizeItemCodes?: { [size: string]: string };
    sizePrices?: { [size: string]: number };
  }>;
  cur_qty?: number;
  stor_id?: number;
  item_code?: string;
  unique_id?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (
    product: Product,
    color: string,
    size: string,
    quantity?: number,
    price?: number
  ) => void;
  removeFromCart: (id: string) => void; // ✅ تغيير: نستخدم ID الفريد فقط
  updateQuantity: (id: string, quantity: number) => void; // ✅ نستخدم ID الفريد
  clearCart: () => void;
  getCartItemsCount: () => number;
  getCartTotal: () => number;
  isProductInCart: (productId: string, color: string, size: string) => boolean;
  getProductQuantity: (
    productId: string,
    color: string,
    size: string
  ) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // ✅ تحميل السلة من localStorage عند التحميل
  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error("Error loading cart from localStorage:", error);
      }
    }
  }, []);

  // ✅ حفظ السلة في localStorage عند كل تغيير
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cartItems));
  }, [cartItems]);

  // ✅ توليد ID فريد للمنتج في السلة
  const generateCartItemId = (modelId: string, color: string, size: string): string => {
    const safeColor = color || "NO-COLOR";
    const safeSize = size || "NO-SIZE";
    return `${modelId}-${safeColor}-${safeSize}`;
  };

  // ✅ إضافة منتج إلى السلة - محدث
  const addToCart = (
    product: Product,
    color: string,
    size: string,
    quantity: number = 1,
    selectedPrice?: number
  ) => {
    setCartItems((prevItems) => {
      const itemId = generateCartItemId(product.modelId, color, size);
      
      const existingItemIndex = prevItems.findIndex(
        (item) => item.id === itemId
      );

      if (existingItemIndex > -1) {
        // ✅ المنتج موجود بالفعل - تحديث الكمية
        const updatedItems = [...prevItems];
        const existingItem = updatedItems[existingItemIndex];

        // ✅ للموظفين: لا تتجاوز الكمية المتاحة
        const newQuantity = existingItem.maxQuantity
          ? Math.min(existingItem.quantity + quantity, existingItem.maxQuantity)
          : existingItem.quantity + quantity;

        updatedItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          price: typeof selectedPrice === "number" && Number.isFinite(selectedPrice)
            ? selectedPrice
            : existingItem.price,
        };

        console.log("🛒 تحديث كمية المنتج:", {
          name: existingItem.name,
          color: existingItem.color,
          size: existingItem.size,
          quantity: newQuantity,
          itemId: itemId
        });

        return updatedItems;
      } else {
        // ✅ الحصول على item_code الصحيح بناءً على اللون والمقاس
        const selectedVariant = product.variants?.find(v => v.color === color);
        let correctItemCode = product.item_code;
        
        if (selectedVariant?.sizeItemCodes && selectedVariant.sizeItemCodes[size]) {
          correctItemCode = selectedVariant.sizeItemCodes[size];
        } 
        else if (selectedVariant?.itemCode) {
          correctItemCode = selectedVariant.itemCode;
        }

        // ✅ منتج جديد - إضافته إلى السلة
        const newItem: CartItem = {
          id: itemId, // ✅ استخدام ID فريد
          name: product.item_name || product.description,
          price:
            typeof selectedPrice === "number" && Number.isFinite(selectedPrice)
              ? selectedPrice
              : product.price,
          color: color || "افتراضي",
          size: size || "ONE SIZE",
          quantity: quantity,
          image: selectedVariant?.imageUrl || product.variants[0]?.imageUrl || "/placeholder-product.jpg",
          item_code: correctItemCode,
          master_code: product.master_code,
          category: product.category || product.group_name || product.kind_name || "",
          modelId: product.modelId, // ✅ حفظ modelId الأصلي
          // ✅ حفظ أقصى كمية للموظفين
          maxQuantity:
            product.cur_qty && product.stor_id === 0
              ? product.cur_qty
              : undefined,
        };

        console.log("🛒 إضافة منتج جديد للسلة:", {
          name: newItem.name,
          id: newItem.id,
          color: newItem.color,
          size: newItem.size,
          item_code: newItem.item_code,
          master_code: newItem.master_code
        });

        return [...prevItems, newItem];
      }
    });
  };

  // ✅ إزالة منتج من السلة - محدث
  const removeFromCart = (id: string) => {
    console.log("🗑️ محاولة إزالة منتج:", id);
    
    setCartItems((prevItems) => {
      const filteredItems = prevItems.filter(item => item.id !== id);
      
      console.log("🔄 قبل الإزالة:", prevItems.length, "بعد الإزالة:", filteredItems.length);
      return filteredItems;
    });
  };

  // ✅ تحديث كمية منتج في السلة - محدث
  const updateQuantity = (id: string, quantity: number) => {
    console.log("🔄 تحديث كمية المنتج:", { id, quantity });
    
    if (quantity <= 0) {
      // ✅ إزالة المنتج إذا كانت الكمية صفر أو أقل
      removeFromCart(id);
      return;
    }

    setCartItems((prevItems) => {
      const updatedItems = prevItems.map((item) => {
        if (item.id === id) {
          // ✅ للموظفين: لا تسمح بتجاوز الكمية المتاحة
          const finalQuantity = item.maxQuantity
            ? Math.min(quantity, item.maxQuantity)
            : quantity;

          console.log(`📦 تحديث كمية ${item.name} من ${item.quantity} إلى ${finalQuantity}`);
          
          return { ...item, quantity: finalQuantity };
        }
        return item;
      });

      return updatedItems;
    });
  };

  // ✅ تفريغ السلة
  const clearCart = () => {
    setCartItems([]);
    console.log("🧹 تم تفريغ السلة");
  };

  // ✅ حساب العدد الإجمالي للمنتجات في السلة
  const getCartItemsCount = () => {
    const count = cartItems.reduce((total, item) => total + item.quantity, 0);
    console.log("📊 عدد المنتجات في السلة:", count);
    return count;
  };

  // ✅ حساب المجموع الكلي للسلة
  const getCartTotal = () => {
    const total = cartItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
    console.log("💰 المجموع الكلي للسلة:", total);
    return total;
  };

  // ✅ التحقق إذا كان المنتج موجود في السلة
  const isProductInCart = (productId: string, color: string, size: string) => {
    const itemId = generateCartItemId(productId, color, size);
    const exists = cartItems.some(item => item.id === itemId);
    console.log(`🔍 التحقق من وجود المنتج ${productId}: ${exists ? 'موجود' : 'غير موجود'}`);
    return exists;
  };

  // ✅ الحصول على كمية منتج معين في السلة
  const getProductQuantity = (
    productId: string,
    color: string,
    size: string
  ) => {
    const itemId = generateCartItemId(productId, color, size);
    const item = cartItems.find(item => item.id === itemId);
    const quantity = item ? item.quantity : 0;
    console.log(`📦 كمية المنتج ${productId}: ${quantity}`);
    return quantity;
  };

  const value: CartContextType = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartItemsCount,
    getCartTotal,
    isProductInCart,
    getProductQuantity,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}