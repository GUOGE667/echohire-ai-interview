import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoHire · AI 面试训练",
  description: "根据目标岗位与职位 JD 生成离线模拟面试题，查看规则复盘与练习记录。",
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
