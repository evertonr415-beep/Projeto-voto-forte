import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MunicipalityFieldEnhancer from "./municipality-field-enhancer";
import CepFallbackEnhancer from "./cep-fallback-enhancer";
import MobileMapLayersToggle from "./mobile-map-layers-toggle";
import MapPinEnhancer from "./map-pin-enhancer";
import UserHierarchyPanel from "./user-hierarchy-panel";
import AccountSettingsEnhancer from "./account-settings-enhancer";
import ReportsSimplifier from "./reports-simplifier";
import "./globals.css";
import "./mobile-map-cleanup.css";
import "./map-pin-enhancer.css";
import "./user-hierarchy.css";
import "./account-settings.css";
import "./reports-simplifier.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VOTO FORTE PARANÁ",
  description: "Gestão inteligente de campanha em todo o Paraná.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/parana-icon-small.jpg",
    shortcut: "/parana-icon-small.jpg",
    apple: "/parana-icon-small.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MunicipalityFieldEnhancer />
        <CepFallbackEnhancer />
        <MobileMapLayersToggle />
        <MapPinEnhancer />
        <UserHierarchyPanel />
        <AccountSettingsEnhancer />
        <ReportsSimplifier />
        {children}
      </body>
    </html>
  );
}
