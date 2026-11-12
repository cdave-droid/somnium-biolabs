import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";
import StructuredData from "./components/StructuredData";
import { SITE_URL, pages, site } from "./site";

const exo2 = Exo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-exo2',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: pages.home.title, template: '%s | Somnium Biolabs' },
  description: pages.home.description,
  applicationName: site.name,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: site.name, title: pages.home.title, description: pages.home.description, url: '/' },
  twitter: { card: 'summary', title: pages.home.title, description: pages.home.description },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={exo2.variable}>
      <body className={`${exo2.className} antialiased`}>
        <StructuredData />
        <Navigation />
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}