import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "globeledger.example";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const origin = new URL(`${protocol}://${host}`);

  return {
    metadataBase: origin,
    title: "GlobeLedger — Every currency, one clear picture",
    description:
      "A calm, multi-currency household ledger that keeps every transaction in its original currency and one trusted base view.",
    icons: {
      icon: "/globe.svg",
      shortcut: "/globe.svg",
    },
    openGraph: {
      title: "GlobeLedger",
      description: "Every currency, one clear picture.",
      type: "website",
      url: origin,
      images: [
        {
          url: new URL("/og.png", origin),
          width: 1731,
          height: 909,
          alt: "GlobeLedger — Every currency, one clear picture.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "GlobeLedger",
      description: "Every currency, one clear picture.",
      images: [new URL("/og.png", origin)],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
