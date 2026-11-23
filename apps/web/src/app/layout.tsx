import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { AuthProvider } from "@/lib/auth";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RailwayVision AI — Pendukung Keputusan Inspeksi",
    template: "%s · RailwayVision AI",
  },
  description:
    "Prototipe inspeksi infrastruktur kereta berbantuan AI dan pengelolaan bukti. Bersifat saran; verifikasi manusia yang berwenang wajib dilakukan.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lg"
        >
          Lewati ke konten utama
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
