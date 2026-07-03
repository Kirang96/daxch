import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import Script from "next/script";
import { IBM_Plex_Mono, IBM_Plex_Sans, Libre_Baskerville } from "next/font/google";

import { ChunkLoadRecovery } from "@/components/chunk-load-recovery";

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap"
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
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
      <body
        className={`${libreBaskerville.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} bg-background font-sans text-foreground antialiased`}
      >
        <ChunkLoadRecovery />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        {children}
      </body>
    </html>
  );
}
