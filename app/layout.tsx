import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AdaptivePerformance from "./adaptive-performance";
import MunicipalityFieldEnhancer from "./municipality-field-enhancer";
import SignupMunicipalityEnhancer from "./signup-municipality-enhancer";
import MunicipalityContextEnhancer from "./municipality-context-enhancer";
import MunicipalElectoralMapContext from "./municipal-electoral-map-context";
import CepFallbackEnhancer from "./cep-fallback-enhancer";
import MapInstantContactBootstrap from "./map-instant-contact-bootstrap";
import MapToolsGate from "./map-tools-gate";
import AccountSettingsEnhancer from "./account-settings-enhancer";
import ContactNavigationInterceptor from "./contact-navigation-interceptor";
import ImportCompletionEnhancer from "./import-completion-enhancer";
import ContactExportEnhancer from "./contact-export-enhancer";
import IntelligenceNavigation from "./intelligence-navigation";
import GestorAccessGate from "./gestor-access-gate";
import RuntimeVersionGuard from "./runtime-version-guard";
import UserHierarchyRemountGuard from "./user-hierarchy-remount-guard";
import AuthReconciliationEnhancer from "./auth-reconciliation-enhancer";
import TeamPerformanceAdminEnhancer from "./team-performance-admin-enhancer";
import WhaticketBroadcastDrawer from "./whaticket-broadcast-drawer";
import TseSidebarEnhancer from "./tse-sidebar-enhancer";
import ComunicacaoSidebarEnhancer from "./comunicacao-sidebar-enhancer";
import "./globals.css";
import "./whaticket-broadcast.css";
import "./adaptive-performance.css";
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
import "./team-performance-admin-enhancer.css";
import "./auth-reconciliation.css";
import "./account-settings.css";
import "./account-session-security.css";
import "./sidebar-scroll-fix.css";
import "./contact-export-history.css";
import "./municipality-multitenant.css";
import "./municipality-management.css";
import "./gestor-access-ui.css";
import "./runtime-version-guard.css";
import "./ux-audit-fixes.css";

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AdaptivePerformance />
        <SignupMunicipalityEnhancer />
        <MunicipalityContextEnhancer />
        <MunicipalityFieldEnhancer />
        <MunicipalElectoralMapContext />
        <CepFallbackEnhancer />
        <MapInstantContactBootstrap />
        <MapToolsGate />
        <GestorAccessGate />
        <AccountSettingsEnhancer />
        <ContactNavigationInterceptor />
        <ImportCompletionEnhancer />
        <ContactExportEnhancer />
        <IntelligenceNavigation />
        <UserHierarchyRemountGuard />
        <AuthReconciliationEnhancer />
        <TeamPerformanceAdminEnhancer />
        <RuntimeVersionGuard />
        <WhaticketBroadcastDrawer />
        <TseSidebarEnhancer />
        <ComunicacaoSidebarEnhancer />
        {children}
      </body>
    </html>
  );
}
