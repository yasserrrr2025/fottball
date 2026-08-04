import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "تسجيل لاعبي فريق كرة القدم - عماد الدين زنكي",
  description: "نظام تسجيل ومراجعة بيانات لاعبي فريق مدرسة عماد الدين زنكي المتوسطة - أبطال دوري المدارس U13 2026",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className={tajawal.className}>{children}</body>
    </html>
  );
}

