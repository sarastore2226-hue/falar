"use client";

import Link from "next/link";
import { useCart } from "../../context/CartContext";
import { useProducts } from "../../context/ProductsContext";
import { useDisplay } from "../../context/DisplayContext";
import { useLanguage } from "../../context/LanguageContext";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useCompanyInfo } from "../../hooks/useCompanyInfo";
import { useAuth } from "../../context/AuthContext";
import OrderNotifications from "./OrderNotifications";

export default function Header() {
  const { getCartItemsCount, cartItems, getCartTotal } = useCart();
  const { categories, setSearchTerm, searchTerm } = useProducts();
  const { companyInfo, loading: companyInfoLoading } = useCompanyInfo();
  const { user, isCustomer, logout } = useAuth();
  const { settings } = useDisplay();
  const { toggleLanguage, isArabic, t } = useLanguage();
  const cartCount = getCartItemsCount();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [isCartHovered, setIsCartHovered] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // ✅ التحقق من حالة المدير والموظف العادي
  const isManager = user?.position === "مدير";
  const isRegularEmployee = user?.position === "موظف";
  const canAccessDashboard = isManager || isRegularEmployee;

  // ✅ تحديث البحث المباشر مع debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(localSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, setSearchTerm]);

  // ✅ تصفية التصنيفات
  const navCategories = useMemo(() => {
    return categories.filter(
      (cat) => cat.kind === "جنس" && cat.name !== "خلفية"
    );
  }, [categories]);

  const navItems = useMemo(
    () => [
      { name: t("common.home"), href: "/" },
      ...navCategories.map((category) => ({
        name: t(category.name),

        href: `/categories/${category.id}`,
      })),
      { name: t("common.allCategories"), href: "/categories" },
      { name: t("common.contact"), href: "/contact" },
    ],
    [navCategories, t]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalSearch(e.target.value);
    },
    []
  );

  const clearSearch = useCallback(() => {
    setLocalSearch("");
    setSearchTerm("");
  }, [setSearchTerm]);

  const closeMenus = useCallback(() => {
    setIsMenuOpen(false);
    setIsSearchOpen(false);
    setIsCartHovered(false);
    setIsUserMenuOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    closeMenus();
  }, [logout, closeMenus]);

  // دالة لتقصير النص
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // ✅ الحصول على لون الأيقونة بناءً على الدور
  const getDashboardIconColor = () => {
    if (isManager)
      return "text-green-600 hover:text-green-700 hover:bg-green-50";
    if (isRegularEmployee)
      return "text-blue-600 hover:text-blue-700 hover:bg-blue-50";
    return "text-gray-600 hover:text-gray-700";
  };

  // ✅ الحصول على نص التلميح بناءً على الدور واللغة
  const getDashboardTooltip = () => {
    if (isArabic) {
      if (isManager) return "لوحة تحكم المدير";
      if (isRegularEmployee) return "لوحة تحكم الموظف";
      return t("common.dashboard");
    } else {
      if (isManager) return "Manager Dashboard";
      if (isRegularEmployee) return "Employee Dashboard";
      return t("common.dashboard");
    }
  };

  const currencyLabel = isArabic ? "ج.م" : "EGP";

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* الشعار */}
          <Link
            href="/"
            className="flex items-center space-x-2 space-x-reverse"
            onClick={closeMenus}
          >
            {companyInfoLoading ? (
              <div className="w-10 h-10" aria-hidden="true" />
            ) : companyInfo?.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={companyInfo.logo}
                alt={companyInfo.company_name || "Logo"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : null}
            {!companyInfoLoading && companyInfo?.company_name ? (
              <span
                className="text-xl font-bold"
                style={{ color: settings.fontColor }}
              >
                {companyInfo.company_name}
              </span>
            ) : null}
          </Link>

          {/* رابط دخول العملاء والموظفين أو معلومات المستخدم */}
          <div className="relative">
            {user ? (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 space-x-reverse p-2 text-gray-600 hover:text-pink-600 transition-colors hover:bg-pink-50 rounded-lg"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    isManager
                      ? "bg-green-500"
                      : isRegularEmployee
                      ? "bg-blue-500"
                      : "bg-purple-500"
                  }`}
                >
                  {user.username.charAt(0)}
                </div>
                <span 
                  className="hidden sm:block text-sm font-medium"
                  style={{ color: settings.fontColor }}
                >
                  {user.username}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isUserMenuOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            ) : (
              <Link
                href="/login"
                className="p-2 text-gray-600 hover:text-pink-600 transition-colors hover:bg-pink-50 rounded-lg"
                onClick={closeMenus}
                title={t("common.login")}
                style={{ color: settings.storeIconColor }}
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </Link>
            )}

            {/* قائمة المستخدم المنسدلة */}
            {isUserMenuOpen && user && (
              <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-100">
                  <p className="font-semibold text-gray-900">{user.username}</p>
                  <p
                    className={`text-sm font-medium ${
                      isManager
                        ? "text-green-600"
                        : isRegularEmployee
                        ? "text-blue-600"
                        : "text-gray-500"
                    }`}
                  >
                    {user.position}
                  </p>
                  <p className="text-xs text-gray-400">{user.usercode}</p>
                </div>
                <div className="p-2">
                  {/* ✅ إضافة رابط الداشبورد للمديرين والموظفين العاديين */}
                  {canAccessDashboard && (
                    <Link
                      href="/dashboard"
                      className="block w-full text-right px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mb-2"
                      onClick={closeMenus}
                    >
                      <div className="flex items-center justify-between">
                        <span>{t("common.dashboard")}</span>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </div>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-right px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    {t("common.logout")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* التبويبات - للشاشات الكبيرة */}
          <nav className="hidden md:flex items-center space-x-4 space-x-reverse">
            {navItems.map((item) => (
              <Link
                key={item.href + item.name}
                href={item.href}
                className="hover:text-pink-600 font-medium px-3 py-2 rounded-lg transition-colors duration-200 hover:bg-pink-50 whitespace-nowrap"
                style={{ color: settings.fontColor }}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* أيقونات البحث والسلة واللغة */}
          <div className="flex items-center space-x-3 space-x-reverse">
            
            {/* ✅ زر تبديل اللغة الأنيق والواضح جداً */}
            <button
              onClick={toggleLanguage}
              type="button"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-300 hover:border-pink-500 hover:bg-pink-50 transition-all font-semibold text-xs shadow-sm"
              style={{ color: settings.fontColor }}
              title={isArabic ? "Switch to English" : "الانتقال للعربية"}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: settings.storeIconColor }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              <span className="uppercase font-bold">
                {isArabic ? "EN" : "عربي"}
              </span>
            </button>

            {/* ✅ إضافة أيقونة الداشبورد للمديرين والموظفين العاديين */}
            {canAccessDashboard && (
              <Link
                href="/dashboard"
                className={`p-2 transition-colors rounded-lg relative group ${getDashboardIconColor()}`}
                onClick={closeMenus}
                title={getDashboardTooltip()}
                style={{ color: settings.storeIconColor }}
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
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>

                {/* تلميح عند التمرير */}
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap">
                    {getDashboardTooltip()}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </Link>
            )}

            {/* ✅ إشعارات الطلبات المباشرة للموظفين والمديرين */}
            {canAccessDashboard && <OrderNotifications />}
            
            {/* لوحة العميل */}
            {isCustomer && (
              <Link
                href="/customer/dashboard"
                className="flex items-center text-gray-700 hover:text-blue-600 transition-colors"
                onClick={closeMenus}
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center ml-2">
                  <span className="text-green-600 text-sm">👤</span>
                </div>
                <span className="text-sm font-medium">
                  {isArabic ? "لوحتي" : "My Dashboard"}
                </span>
              </Link>
            )}

            {/* مربع البحث المصغر */}
            <div className="hidden sm:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t("common.search")}
                  value={localSearch}
                  onChange={handleSearchChange}
                  className="w-40 lg:w-48 h-9 pl-3 pr-9 rounded-lg bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm transition-all duration-200"
                  style={{ color: settings.fontColor }}
                />
                {localSearch ? (
                  <button
                    onClick={clearSearch}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-pink-600 transition-colors"
                    aria-label="مسح البحث"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                ) : (
                  <div 
                    className="absolute left-2 top-1/2 transform -translate-y-1/2"
                    style={{ color: settings.storeIconColor }}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* زر البحث للموبايل */}
            <button
              className="sm:hidden p-2 hover:text-pink-600 transition-colors hover:bg-pink-50 rounded-lg"
              onClick={() => setIsSearchOpen(true)}
              aria-label="بحث"
              style={{ color: settings.storeIconColor }}
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>

            {/* سلة التسوق مع Tooltip */}
            <div
              className="relative"
              onMouseEnter={() => setIsCartHovered(true)}
              onMouseLeave={() => setIsCartHovered(false)}
            >
              <Link
                href="/cart"
                className="relative flex items-center hover:text-pink-600 transition-colors hover:bg-pink-50 rounded-lg p-2"
                onClick={closeMenus}
                style={{ color: settings.storeIconColor }}
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

                {/* عداد السلة */}
                {cartCount > 0 && (
                  <span className="mr-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold border border-white shadow-sm">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>

              {/* Tooltip ملخص السلة */}
              {isCartHovered && cartItems.length > 0 && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50">
                  <div className="p-4">
                    {/* العنوان */}
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">
                        {t("cart.title")}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {cartCount} {isArabic ? "منتج" : "items"}
                      </span>
                    </div>

                    {/* قائمة المنتجات */}
                    <div className="max-h-60 overflow-y-auto space-y-3">
                      {cartItems.slice(0, 5).map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 space-x-reverse bg-gray-50 rounded-lg p-2"
                        >
                          {/* صورة المنتج */}
                          <div className="w-12 h-12 bg-white rounded-lg border border-gray-200 flex-shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                item.image ||
                                "https://via.placeholder.com/50x50/FFFFFF/666666?text=No+Image"
                              }
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* تفاصيل المنتج */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {truncateText(item.name, 25)}
                            </p>
                            <div className="flex items-center space-x-2 space-x-reverse text-xs text-gray-500 mt-1">
                              <span>{item.color}</span>
                              <span>•</span>
                              <span>{item.size}</span>
                              <span>•</span>
                              <span>{item.quantity}x</span>
                            </div>
                          </div>

                          {/* السعر */}
                          <div className="text-sm font-semibold text-blue-600 flex-shrink-0">
                            {item.price * item.quantity} {currencyLabel}
                          </div>
                        </div>
                      ))}

                      {/* إذا كان هناك أكثر من 5 منتجات */}
                      {cartItems.length > 5 && (
                        <div className="text-center py-2">
                          <span className="text-sm text-gray-500">
                            +{cartItems.length - 5} {isArabic ? "منتجات أخرى" : "more items"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* المجموع والذهاب للسلة */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-gray-900">
                          {t("cart.total")}
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {getCartTotal()} {currencyLabel}
                        </span>
                      </div>
                      <Link
                        href="/cart"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center"
                        onClick={closeMenus}
                      >
                        <svg
                          className="w-4 h-4 ml-1"
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
                        {t("cart.title")}
                      </Link>
                    </div>
                  </div>

                  {/* السهم */}
                  <div className="absolute -top-2 left-6 transform -translate-x-1/2">
                    <div className="w-4 h-4 bg-white border-t border-l border-gray-200 transform rotate-45"></div>
                  </div>
                </div>
              )}
            </div>

            {/* زر القائمة للموبايل */}
            <button
              className="md:hidden p-2 hover:text-pink-600 transition-colors hover:bg-pink-50 rounded-lg"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="فتح القائمة"
              style={{ color: settings.storeIconColor }}
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* القائمة المنسدلة للموبايل */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 py-4">
            <nav className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href + item.name}
                  href={item.href}
                  className="hover:text-pink-600 font-medium px-4 py-3 rounded-lg transition-colors duration-200 hover:bg-pink-50"
                  onClick={closeMenus}
                  style={{ color: settings.fontColor }}
                >
                  {item.name}
                </Link>
              ))}
              {/* إضافة رابط الداشبورد في القائمة المتنقلة للمديرين والموظفين */}
              {canAccessDashboard && (
                <Link
                  href="/dashboard"
                  className={`font-medium px-4 py-3 rounded-lg transition-colors duration-200 flex items-center space-x-2 space-x-reverse ${
                    isManager
                      ? "text-green-700 hover:text-green-800 hover:bg-green-50"
                      : "text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                  }`}
                  onClick={closeMenus}
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
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  <span>
                    {isManager ? (isArabic ? "لوحة تحكم المدير" : "Manager Dashboard") : (isArabic ? "لوحة تحكم الموظف" : "Employee Dashboard")}
                  </span>
                </Link>
              )}
            </nav>
          </div>
        )}

        {/* البحث للموبايل */}
        {isSearchOpen && (
          <div className="sm:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-200 p-4 shadow-lg">
            <div className="relative">
              <input
                type="text"
                placeholder={t("common.search")}
                value={localSearch}
                onChange={handleSearchChange}
                className="w-full h-10 pl-3 pr-9 rounded-lg bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                autoFocus
                style={{ color: settings.fontColor }}
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-pink-600 transition-colors"
                aria-label="إغلاق البحث"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}