import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AdaptivePerformance from "./adaptive-performance";
import SignupMunicipalityEnhancer from "./signup-municipality-enhancer";
import DashboardRuntimeEnhancers from "./dashboard-runtime-enhancers";
import ThemeToggleEnhancer from "./theme-toggle-enhancer";
import PwaInstaller from "./pwa-installer";
import "./globals.css";
import "./agenda-mobile-v3.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem('voto-forte-theme')||'dark';document.documentElement.dataset.vfTheme=t;document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.dataset.vfTheme='dark';document.documentElement.style.colorScheme='dark';}})();`;
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover", themeColor: "#051929" };
export const metadata: Metadata = { title: "VOTO FORTE PARANÁ", description: "Gestão inteligente de campanha em todo o Paraná." };

export default function RootLayout({children}:{children: React.ReactNode;}) {
  return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:THEME_BOOTSTRAP_SCRIPT}} /></head><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}><PwaInstaller /><AdaptivePerformance /><SignupMunicipalityEnhancer /><ThemeToggleEnhancer /><DashboardRuntimeEnhancers />{children}</body></html>;
}
