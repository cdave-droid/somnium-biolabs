import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";

const exo2 = Exo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-exo2',
});

export const metadata: Metadata = {
  title: "Somnium Biolabs",
  description: "Innovative technology solutions for the future",
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
        <Navigation />
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}