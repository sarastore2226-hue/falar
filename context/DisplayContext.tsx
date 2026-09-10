"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface DisplaySettings {
  fontColor: string;
  storeIconColor: string;
  promotionIconColor: string;
}

interface DisplayContextType {
  settings: DisplaySettings;
  updateSettings: (newSettings: Partial<DisplaySettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: DisplaySettings = {
  fontColor: "#000000",
  storeIconColor: "#FF6B6B",
  promotionIconColor: "#4ECDC4",
};

// وضع القيم الافتراضية لمنع حدوث Crash في حال تم استدعاء الـ hook مبكراً
const DisplayContext = createContext<DisplayContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  resetSettings: () => {},
});

export function DisplayProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);

  // تحميل الإعدادات من localStorage عند تحميل الصفحة بالمتصفح
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("displaySettings");
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error("Error loading display settings:", error);
    }
  }, []);

  // حقن الألوان كـ CSS Variables في المتجر بالكامل تلقائياً
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--main-font-color", settings.fontColor || DEFAULT_SETTINGS.fontColor);
      root.style.setProperty("--store-icon-color", settings.storeIconColor || DEFAULT_SETTINGS.storeIconColor);
      root.style.setProperty("--promo-color", settings.promotionIconColor || DEFAULT_SETTINGS.promotionIconColor);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<DisplaySettings>) => {
    setSettings((prev) => {
      const updatedSettings = { ...prev, ...newSettings };
      try {
        localStorage.setItem("displaySettings", JSON.stringify(updatedSettings));
      } catch (error) {
        console.error("Error saving display settings:", error);
      }
      return updatedSettings;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem("displaySettings", JSON.stringify(DEFAULT_SETTINGS));
    } catch (error) {
      console.error("Error resetting display settings:", error);
    }
  };

  return (
    <DisplayContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </DisplayContext.Provider>
  );
}

export function useDisplay() {
  const context = useContext(DisplayContext);
  // أمان إضافي: يعيد القيم الافتراضية بدلاً من رمي خطأ وإيقاف الموقع
  if (!context) {
    return {
      settings: DEFAULT_SETTINGS,
      updateSettings: () => {},
      resetSettings: () => {},
    };
  }
  return context;
}