"use client";

import React, { useState } from "react";
import { useDisplay } from "@/context/DisplayContext";
import styles from "./DisplaySettings.module.css";

export default function DisplaySettings() {
  const { settings, updateSettings, resetSettings } = useDisplay();
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [colorErrors, setColorErrors] = useState<{
    fontColor?: string;
    storeIconColor?: string;
    promotionIconColor?: string;
  }>({});

  // ✅ دالة للتحقق من صحة كود اللون
  const isValidColor = (color: string): boolean => {
    // HEX format
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) return true;
    // RGB format
    if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color)) return true;
    // RGBA format
    if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/.test(color)) return true;
    // CSS color names
    const validColors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'orange', 'purple', 'pink', 'gray', 'cyan', 'magenta'];
    return validColors.includes(color.toLowerCase());
  };

  const handleColorChange = (
    key: "fontColor" | "storeIconColor" | "promotionIconColor",
    value: string
  ) => {
    if (isValidColor(value)) {
      updateSettings({ [key]: value });
      setColorErrors({ ...colorErrors, [key]: undefined });
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 2000);
    } else {
      setColorErrors({ ...colorErrors, [key]: "كود اللون غير صحيح" });
    }
  };

  const handleReset = () => {
    if (
      confirm("هل تريد إعادة تعيين جميع الألوان إلى الإعدادات الافتراضية؟")
    ) {
      resetSettings();
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 2000);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>⚙️ ضبط العرض</h1>
        <p>قم بتخصيص ألوان الفونت والأيقونات حسب رغبتك</p>
      </div>

      {showSaveMessage && (
        <div className={styles.successMessage}>✓ تم الحفظ بنجاح</div>
      )}

      <div className={styles.settingsGrid}>
        {/* Font Color Setting */}
        <div className={styles.settingCard}>
          <div className={styles.settingHeader}>
            <h3>🔤 لون الفونت العام</h3>
            <span className={styles.colorLabel}>{settings.fontColor}</span>
          </div>
          <div className={styles.colorPickerWrapper}>
            <input
              type="color"
              value={settings.fontColor}
              onChange={(e) => handleColorChange("fontColor", e.target.value)}
              className={styles.colorPicker}
            />
            <div
              className={styles.colorPreview}
              style={{ backgroundColor: settings.fontColor }}
            >
              <span style={{ color: settings.fontColor }}>نص تجريبي</span>
            </div>
          </div>
          <input
            type="text"
            placeholder="أدخل كود اللون (#HEX أو rgb أو اسم)"
            value={settings.fontColor}
            onChange={(e) => handleColorChange("fontColor", e.target.value)}
            className={`${styles.colorCodeInput} ${colorErrors.fontColor ? styles.errorInput : ""}`}
          />
          {colorErrors.fontColor && (
            <span className={styles.errorMessage}>{colorErrors.fontColor}</span>
          )}
        </div>

        {/* Store Icon Color Setting */}
        <div className={styles.settingCard}>
          <div className={styles.settingHeader}>
            <h3>🏪 لون أيقونات المتجر</h3>
            <span className={styles.colorLabel}>
              {settings.storeIconColor}
            </span>
          </div>
          <div className={styles.colorPickerWrapper}>
            <input
              type="color"
              value={settings.storeIconColor}
              onChange={(e) =>
                handleColorChange("storeIconColor", e.target.value)
              }
              className={styles.colorPicker}
            />
            <div
              className={styles.colorPreview}
              style={{ backgroundColor: settings.storeIconColor }}
            >
              <span style={{ color: "white", fontWeight: "bold" }}>🏪</span>
            </div>
          </div>
          <input
            type="text"
            placeholder="أدخل كود اللون (#HEX أو rgb أو اسم)"
            value={settings.storeIconColor}
            onChange={(e) => handleColorChange("storeIconColor", e.target.value)}
            className={`${styles.colorCodeInput} ${colorErrors.storeIconColor ? styles.errorInput : ""}`}
          />
          {colorErrors.storeIconColor && (
            <span className={styles.errorMessage}>{colorErrors.storeIconColor}</span>
          )}
        </div>

        {/* Promotion Icon Color Setting */}
        <div className={styles.settingCard}>
          <div className={styles.settingHeader}>
            <h3>🎁 لون أيقونات العروض</h3>
            <span className={styles.colorLabel}>
              {settings.promotionIconColor}
            </span>
          </div>
          <div className={styles.colorPickerWrapper}>
            <input
              type="color"
              value={settings.promotionIconColor}
              onChange={(e) =>
                handleColorChange("promotionIconColor", e.target.value)
              }
              className={styles.colorPicker}
            />
            <div
              className={styles.colorPreview}
              style={{ backgroundColor: settings.promotionIconColor }}
            >
              <span style={{ color: "white", fontWeight: "bold" }}>🎁</span>
            </div>
          </div>
          <input
            type="text"
            placeholder="أدخل كود اللون (#HEX أو rgb أو اسم)"
            value={settings.promotionIconColor}
            onChange={(e) => handleColorChange("promotionIconColor", e.target.value)}
            className={`${styles.colorCodeInput} ${colorErrors.promotionIconColor ? styles.errorInput : ""}`}
          />
          {colorErrors.promotionIconColor && (
            <span className={styles.errorMessage}>{colorErrors.promotionIconColor}</span>
          )}
        </div>
      </div>

      <div className={styles.currentSettings}>
        <h3>الإعدادات الحالية</h3>
        <div className={styles.settingsList}>
          <div className={styles.settingItem}>
            <span>لون الفونت:</span>
            <span
              className={styles.colorBox}
              style={{ backgroundColor: settings.fontColor }}
            ></span>
          </div>
          <div className={styles.settingItem}>
            <span>لون أيقونات المتجر:</span>
            <span
              className={styles.colorBox}
              style={{ backgroundColor: settings.storeIconColor }}
            ></span>
          </div>
          <div className={styles.settingItem}>
            <span>لون أيقونات العروض:</span>
            <span
              className={styles.colorBox}
              style={{ backgroundColor: settings.promotionIconColor }}
            ></span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.resetButton} onClick={handleReset}>
          ↻ إعادة تعيين الإعدادات
        </button>
      </div>
    </div>
  );
}
