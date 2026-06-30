import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import Script from "next/script";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Daxch — AI watches your stocks. You approve every trade.",
  description:
    "Thesis-aware AI monitoring for Indian investors. Dedicated agents per stock, human-in-the-loop Upstox execution.",
  openGraph: {
    title: "Daxch — AI Stock Monitoring",
    description: "AI watches your stocks on your terms. You approve every trade.",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-background text-foreground antialiased`}>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        {children}
      </body>
    </html>
  );
}
