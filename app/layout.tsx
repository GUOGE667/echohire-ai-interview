import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoHire · AI 面试训练",
  description: "根据简历与岗位描述生成专属模拟面试，获得可解释的能力分析。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
