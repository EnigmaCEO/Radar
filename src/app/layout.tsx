import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Radar by Sagitta — DeFi Infrastructure Intelligence",
    template: "%s | Radar",
  },
  description:
    "Real-time monitoring of oracle prices, bridge routes, and LP pools across every major chain. Alerts delivered to Discord, Telegram, and webhook.",
  metadataBase: new URL("https://radar.sagitta.systems"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://radar.sagitta.systems",
    siteName: "Radar by Sagitta",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
