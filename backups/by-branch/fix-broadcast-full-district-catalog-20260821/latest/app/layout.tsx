import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BroadcastDistrictFilterCatalogEnhancer from "./broadcast-district-filter-catalog-enhancer";
import PwaInstaller from "./pwa-installer";
import WhaticketBroadcastDrawer from "./whaticket-broadcast-drawer";
import BroadcastNeighborhoodOptionsEnhancer from "./broadcast-neighborhood-options-enhancer";
import "./globals.css";
import "./whaticket-broadcast.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export const metadata: Metadata = { title: "VOTO FORTE PARANÁ" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <PwaInstaller />
        <WhaticketBroadcastDrawer />
        <BroadcastNeighborhoodOptionsEnhancer />
        <BroadcastDistrictFilterCatalogEnhancer />
        {children}
      </body>
    </html>
  );
}
