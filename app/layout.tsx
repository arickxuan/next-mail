import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "多账户邮件管理",
  description: "Next.js 多账户邮件管理项目"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
