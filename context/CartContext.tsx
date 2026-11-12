"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

const PIECES_PER_SERIA = 4; // معامل التحويل: كل سرية = 4 قطع

export interface CartItem {
  id: string; // فريد: modelId-color
  name: string;
  price: number; // سعر القطعة الواحدة
  color: string;
  size: string; // محتفظ بها كـ ONE SIZE للتوافق
  seriesQuantity: number; // عدد السريات المطلوبة
  quantity: number; // إجمالي عدد القطع (seriesQuantity * 4)
  image: string;
  item_code?: string;
  master_code?: string;
  category?: string;
  modelId?: string;
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
    cur_qty?: number;
    stor_id?: number;
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
    size?: string,
    quantity?: number, // عدد السريات
    price?: number
  ) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void; // تحديث عدد السريات
  clearCart: () => void;
  getCartItemsCount: () => number; // عدد السريات
  getCartPiecesCount: () => number; // عدد القطع التام
  getCartTotal: () => number;
  isProductInCart: (productId: string, color: string, size?: string) => boolean;
  getProductQuantity: (
    productId: string,
    color: string,
    size?: string
  ) => number;
  PIECES_PER_SERIA: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

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

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cartItems));
  }, [cartItems]);

  const generateCartItemId = (modelId: string, color: string): string => {
    const safeColor = color || "NO-COLOR";
    return `${modelId}-${safeColor}`;
  };

  const addToCart = (
    product: Product,
    color: string,
    _size?: string,
    seriesQty: number = 1,
    selectedPrice?: number
  ) =>  {
    setCartItems((prevItems) => {
      const itemId = generateCartItemId(product.modelId, color);
      const existingItemIndex = prevItems.findIndex((item) => item.id === itemId);

      const finalPiecePrice =
        typeof selectedPrice === "number" && Number.isFinite(selectedPrice)
          ? selectedPrice
          : product.price;

      if (existingItemIndex > -1) {
        const updatedItems = [...prevItems];
        const existingItem = updatedItems[existingItemIndex];

        const newSeriesQty = existingItem.maxQuantity
          ? Math.min(existingItem.seriesQuantity + seriesQty, existingItem.maxQuantity)
          : existingItem.seriesQuantity + seriesQty;

        updatedItems[existingItemIndex] = {
          ...existingItem,
          seriesQuantity: newSeriesQty,
          quantity: newSeriesQty * PIECES_PER_SERIA,
          price: finalPiecePrice,
        };

        return updatedItems;
      } else {
        const selectedVariant = product.variants?.find((v) => v.color === color);
        const correctItemCode =
          selectedVariant?.itemCode || product.item_code || product.master_code;

        const maxSeries =
          product.cur_qty && product.stor_id === 0
            ? Math.floor(product.cur_qty / PIECES_PER_SERIA)
            : undefined;

        const newItem: CartItem = {
          id: itemId,
          name: product.item_name || product.description,
          price: finalPiecePrice,
          color: color || "افتراضي",
          size: "ONE SIZE",
          seriesQuantity: seriesQty,
          quantity: seriesQty * PIECES_PER_SERIA,
          image:
            selectedVariant?.imageUrl ||
            product.variants?.[0]?.imageUrl ||
            "/placeholder-product.jpg",
          item_code: correctItemCode,
          master_code: product.master_code,
          category: product.category || product.group_name || product.kind_name || "",
          modelId: product.modelId,
          maxQuantity: maxSeries,
        };

        return [...prevItems, newItem];
      }
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, seriesQty: number) => {
    if (seriesQty <= 0) {
      removeFromCart(id);
      return;
    }

    setCartItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id === id) {
          const finalSeriesQty = item.maxQuantity
            ? Math.min(seriesQty, item.maxQuantity)
            : seriesQty;

          return {
            ...item,
            seriesQuantity: finalSeriesQty,
            quantity: finalSeriesQty * PIECES_PER_SERIA,
          };
        }
        return item;
      });
    });
  };

  const clearCart = () => {
    setCartItems([]);
  };

  // إجمالي السريات في السلة
  const getCartItemsCount = () => {
    return cartItems.reduce((total, item) => total + (item.seriesQuantity || 1), 0);
  };

  // إجمالي القطع في السلة
  const getCartPiecesCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  // إجمالي الحساب = عدد القطع الإجمالي * سعر القطعة
  const getCartTotal = () => {
    return cartItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  };

  const isProductInCart = (productId: string, color: string) => {
    const itemId = generateCartItemId(productId, color);
    return cartItems.some((item) => item.id === itemId);
  };

  const getProductQuantity = (productId: string, color: string) => {
    const itemId = generateCartItemId(productId, color);
    const item = cartItems.find((i) => i.id === itemId);
    return item ? item.seriesQuantity : 0;
  };

  const value: CartContextType = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartItemsCount,
    getCartPiecesCount,
    getCartTotal,
    isProductInCart,
    getProductQuantity,
    PIECES_PER_SERIA,
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