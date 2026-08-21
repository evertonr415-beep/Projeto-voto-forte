import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AdaptivePerformance from "./adaptive-performance";
import SignupMunicipalityEnhancer from "./signup-municipality-enhancer";
import DashboardRuntimeEnhancers from "./dashboard-runtime-enhancers";
import PwaInstaller from "./pwa-installer";
import "./globals.css";
import "./compact-overview-scope.css";
import "./neighborhood-info-drawer.css";
import "./map-neighborhood-permissions.css";
import "./system-notifications.css";
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
import "./voto-forte-unified-theme.css";
import "./topbar-theme-sync.css";
import "./profile-modal-premium.css";
import "./remove-electoral-back-system.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#051929",
};

export const metadata: Metadata = {
  title: "VOTO FORTE PARANÁ",
  description: "Gestão inteligente de campanha em todo o Paraná.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VOTO FORTE",
    startupImage: ["/voto-forte-bandeira-icon.jpg"],
  },
  other: {
    "codex-preview": "development",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
  icons: {
    icon: "/voto-forte-bandeira-icon.jpg",
    shortcut: "/voto-forte-bandeira-icon.jpg",
    apple: "/voto-forte-bandeira-icon.jpg",
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
        <PwaInstaller />
        <AdaptivePerformance />
        <SignupMunicipalityEnhancer />
        <DashboardRuntimeEnhancers />
        {children}
      </body>
    </html>
  );
}
