import type { Metadata } from "next";
import { Comfortaa, Inter } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "./components/ConditionalLayout";

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BBA Management Dashboard",
  description: "BBA Bookkeeping internal management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${comfortaa.variable} ${inter.variable} h-full`} style={{ '--sidebar-width': '256px' } as React.CSSProperties}>
      <body className="h-full text-slate-800 antialiased bg-background">
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
