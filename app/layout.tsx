import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MunicipalityFieldEnhancer from "./municipality-field-enhancer";
import CepFallbackEnhancer from "./cep-fallback-enhancer";
import MapInstantContactBootstrap from "./map-instant-contact-bootstrap";
import MapToolsGate from "./map-tools-gate";
import UserHierarchyRemountGuard from "./user-hierarchy-remount-guard";
import AccountSettingsEnhancer from "./account-settings-enhancer";
import ReportsSimplifier from "./reports-simplifier";
import ContactNavigationInterceptor from "./contact-navigation-interceptor";
import ImportCompletionEnhancer from "./import-completion-enhancer";
import TeamIntelligenceNavigation from "./team-intelligence-navigation";
import SystemIntelligenceNavigation from "./system-intelligence-navigation";
import ExactLegacyMetrics from "./exact-legacy-metrics";
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
import "./map-strategy-insights.css";
import "./executive-dashboard.css";
import "./data-quality-panel.css";
import "./user-hierarchy.css";
import "./account-settings.css";
import "./reports-simplifier.css";
import "./sidebar-scroll-fix.css";

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
        <MapInstantContactBootstrap />
        <MapToolsGate />
        <UserHierarchyRemountGuard />
        <AccountSettingsEnhancer />
        <ReportsSimplifier />
        <ContactNavigationInterceptor />
        <ImportCompletionEnhancer />
        <TeamIntelligenceNavigation />
        <SystemIntelligenceNavigation />
        <ExactLegacyMetrics />
        {children}
      </body>
    </html>
  );
}
