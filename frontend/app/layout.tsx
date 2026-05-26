import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-active-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-active-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Artha Analytics",
  description: "AI-powered equity analytics for Indian markets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
