import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebToApp - Converti il tuo sito in App Nativa",
  description: "Trasforma istantaneamente il tuo progetto web in un'app Android e iOS professionale.",
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
