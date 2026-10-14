import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebToApp — Convert your website into a native Android app",
  description: "Turn any website or HTML/CSS/JS project into an installable Android APK with one click. Built by Alex Mirici — Web Developer.",
  authors: [{ name: "Alex Mirici", url: "https://alexmirici.netlify.app" }],
  creator: "Alex Mirici",
  publisher: "Alex Mirici",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
