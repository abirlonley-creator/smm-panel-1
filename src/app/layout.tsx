import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AuraSMM — Minimalist SMM Panel & Growth Planner",
  description: "A clean, reliable SMM ordering platform with third-party provider API integration, an intelligent delivery scheduler, and transparent delivery previews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-[#F8F9FD] text-[#252943] min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
