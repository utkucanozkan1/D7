import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Pis Yedili - Online Mau Mau Card Game",
  description: "Play Pis Yedili (Mau Mau) online with friends. Real-time multiplayer card game with chat.",
  keywords: ["Pis Yedili", "Mau Mau", "card game", "online", "multiplayer", "Turkish"],
  authors: [{ name: "Pis Yedili Team" }],
  creator: "Pis Yedili",
  publisher: "Pis Yedili",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: "Pis Yedili - Online Mau Mau Card Game",
    description: "Play Pis Yedili (Mau Mau) online with friends. Real-time multiplayer card game with chat.",
    type: "website",
    locale: "en_US",
    alternateLocale: ["tr_TR"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pis Yedili - Online Mau Mau Card Game",
    description: "Play Pis Yedili (Mau Mau) online with friends. Real-time multiplayer card game with chat.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <div className="min-h-full bg-background text-foreground">
          {children}
        </div>
      </body>
    </html>
  );
}
