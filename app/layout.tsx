import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { ProductsProvider } from "./../context/ProductsContext";
import { AuthProvider } from "./../context/AuthContext";
// 1. استيراد المكون الجديد
import VisitorTracker from "./components/VisitorTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "متجر أحلام - ملابس أطفال",
  description:
    "متجر أحلام لأجمل وأحدث صيحات موضة الأطفال بجودة عالية وأسعار مناسبة",
  keywords: "ملابس أطفال, أزياء أطفال, متجر أطفال, أطفال, موضة",
  authors: [{ name: "متجر أحلام" }],
  openGraph: {
    title: "متجر أحلام - ملابس أطفال",
    description: "أجمل وأحدث صيحات موضة الأطفال",
    type: "website",
    locale: "ar_EG",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "متجر فوي",
    description: "متجر فوي لأجمل وأحدث صيحات موضة الأطفال",
    url: "https://vooy.shop",
    telephone: "+201016284836",
    address: {
      "@type": "PostalAddress",
      addressCountry: "EG",
    },
  };

  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://images.vooy.shop" />
        <link rel="dns-prefetch" href="//images.vooy.shop" />
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <meta name="theme-color" content="#3B82F6" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <ProductsProvider>
            <CartProvider>
              {/* 2. إضافة المكون هنا ليقوم بعد الزوار */}
              <VisitorTracker />
              {children}
            </CartProvider>
          </ProductsProvider>
        </AuthProvider>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
      </body>
    </html>
  );
}