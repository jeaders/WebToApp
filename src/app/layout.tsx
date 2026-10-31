import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const SITE_URL = "https://webstoapp.netlify.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "WebToApp — Convert your website into a native Android app",
  description:
    "Turn any website or HTML/CSS/JS project into an installable Android APK with one click. Built by Alex Mirici — Web Developer.",
  applicationName: "WebToApp",
  authors: [{ name: "Alex Mirici", url: "https://alexmirici.netlify.app" }],
  creator: "Alex Mirici",
  publisher: "Alex Mirici",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    title: "WebToApp",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "WebToApp",
    title: "WebToApp — Website to Android APK",
    description:
      "Turn any website or HTML/CSS/JS project into an installable Android APK with one click.",
    url: SITE_URL,
    images: [
      {
        url: "/og.png",
        width: 1280,
        height: 640,
        alt: "WebToApp — turn any website into a native Android app",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WebToApp — Website to Android APK",
    description:
      "Turn any website or HTML/CSS/JS project into an installable Android APK with one click.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  other: {
    "google-site-verification": "5bcC3H8bW5Y0H1xXQ5qURNMZOI11aW2zsfbgZONunok",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0070f3",
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
    <html lang="en">
      <body className="antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
