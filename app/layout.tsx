import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { LedgerNavigation } from "@/components/ledger-navigation";
import type { Language } from "@/lib/language";
import { requestLanguage } from "@/lib/request-language";
import "./globals.css";

const METADATA_COPY: Record<
  Language,
  { title: string; description: string; tagline: string }
> = {
  en: {
    title: "GlobeLedger — Every currency, one clear picture",
    description:
      "A calm, multi-currency household ledger that keeps every transaction in its original currency and one trusted base view.",
    tagline: "Every currency, one clear picture.",
  },
  ko: {
    title: "GlobeLedger — 모든 통화를 한눈에",
    description:
      "모든 거래를 원 결제 통화로 보존하고 하나의 기준 통화로 보여주는 다중 통화 가계부입니다.",
    tagline: "모든 통화를 한눈에 명확하게.",
  },
  ja: {
    title: "GlobeLedger — すべての通貨をひと目で",
    description:
      "すべての取引を元の通貨で保存し、一つの基準通貨で確認できる多通貨対応の家計簿です。",
    tagline: "すべての通貨を、ひと目で明確に。",
  },
  ru: {
    title: "GlobeLedger — все валюты в одной картине",
    description:
      "Мультивалютный учёт финансов: исходные суммы операций сохраняются, а общая картина отображается в основной валюте.",
    tagline: "Все валюты — в одной понятной картине.",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [requestHeaders, language] = await Promise.all([
    headers(),
    requestLanguage(),
  ]);
  const copy = METADATA_COPY[language];
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
    title: copy.title,
    description: copy.description,
    icons: {
      icon: "/globe.svg",
      shortcut: "/globe.svg",
    },
    openGraph: {
      title: "GlobeLedger",
      description: copy.tagline,
      type: "website",
      url: origin,
      images: [
        {
          url: new URL("/og.png", origin),
          width: 1731,
          height: 909,
          alt: copy.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "GlobeLedger",
      description: copy.tagline,
      images: [new URL("/og.png", origin)],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await requestLanguage();
  return (
    <html lang={language} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <LedgerNavigation initialLanguage={language}>{children}</LedgerNavigation>
      </body>
    </html>
  );
}
