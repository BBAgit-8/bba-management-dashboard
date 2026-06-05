import type { Metadata } from "next";
import { Comfortaa, Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";

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
  title: "Management Dashboard",
  description: "Corporate management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${comfortaa.variable} ${inter.variable} h-full`}
    >
      <body className="h-full text-slate-100 antialiased">
        <Sidebar />
        {/* Main content — offset by sidebar width */}
        <main className="ml-64 flex min-h-screen flex-col">
          <div className="flex-1 p-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
