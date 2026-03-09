import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // サイトのタイトルと説明
  title: "株ダッシュボード",
  description: "株のチャート一覧・シグナル通知サイト",
  // ファビコンを📈に設定
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📈</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 日本語対応・ダークモード対応
    <html lang="ja" className="dark">
      <body className={`${geistSans.variable} antialiased bg-gray-950 text-gray-100`}>
        {children}
      </body>
    </html>
  );
}
