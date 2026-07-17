import type { Metadata } from "next";
import { Caprasimo, Karla } from "next/font/google";
import "./globals.css";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  display: "swap",
});

const caprasimo = Caprasimo({
  variable: "--font-caprasimo",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Limon | De Google Maps a tu propia web",
  description:
    "Pega el link de Google Maps de tu restaurante y Limon arma una web con carácter en segundos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${karla.variable} ${caprasimo.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
