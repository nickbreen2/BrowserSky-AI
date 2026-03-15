import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Gelasio } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const gelasio = Gelasio({
  weight: "600",
  variable: "--font-gelasio",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrowserSky AI",
  description: "Chat with any web page, instantly.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} ${gelasio.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
