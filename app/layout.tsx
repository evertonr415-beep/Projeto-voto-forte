import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MunicipalityFieldEnhancer from "./municipality-field-enhancer";
import CepFallbackEnhancer from "./cep-fallback-enhancer";
import MobileMapLayersToggle from "./mobile-map-layers-toggle";
import MobileAnalyticsControls from "./mobile-analytics-controls";
import LegacyContactGeocoder from "./legacy-contact-geocoder";
import SafeMapContactTools from "./safe-map-contact-tools";
import MapTerritoryEnhancer from "./map-territory-enhancer";
import MapGeocodingPanel from "./map-geocoding-panel";
import MapDistrictFilter from "./map-district-filter";
import MapHeatmapEnhancer from "./map-heatmap-enhancer";
import MapDistrictSummary from "./map-district-summary";
import MapPriorityPanel from "./map-priority-panel";
import UserHierarchyPanel from "./user-hierarchy-panel";
import AccountSettingsEnhancer from "./account-settings-enhancer";
import ReportsSimplifier from "./reports-simplifier";
import "./globals.css";
import "./mobile-map-cleanup.css";
import "./mobile-analytics-controls.css";
import "./map-layout-compact.css";
import "./safe-map-contact-tools.css";
import "./map-territory-enhancer.css";
import "./map-geocoding-panel.css";
import "./map-district-filter.css";
import "./map-heatmap-enhancer.css";
import "./map-district-summary.css";
import "./map-priority-panel.css";
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
        <MobileAnalyticsControls />
        <LegacyContactGeocoder />
        <SafeMapContactTools />
        <MapTerritoryEnhancer />
        <MapGeocodingPanel />
        <MapDistrictFilter />
        <MapHeatmapEnhancer />
        <MapDistrictSummary />
        <MapPriorityPanel />
        <UserHierarchyPanel />
        <AccountSettingsEnhancer />
        <ReportsSimplifier />
        {children}
      </body>
    </html>
  );
}
