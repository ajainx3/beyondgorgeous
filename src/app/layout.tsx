import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Watermark from "@/components/Watermark";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BeyondGorgeous - Beauty & Cosmetics Online Store",
  description:
    "Shop the best in beauty, skincare, haircare, and makeup at BeyondGorgeous. Premium brands, great prices, and fast delivery across India.",
  keywords: [
    "beauty",
    "cosmetics",
    "skincare",
    "makeup",
    "haircare",
    "online shopping",
    "India",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white">
        <Watermark />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
