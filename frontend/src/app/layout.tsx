import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/AuthContext";

// Import unified Tailwind CSS stylesheet
import "./globals.css";

const fontBodyClass = "font-sans";

import LoadingScreen from "./LoadingScreen";
import ServiceWorkerRegistrar from "./ServiceWorkerRegistrar";

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "HTU Elect ✓ - Secure Digital Elections & Cryptographic Verification",
  description: "Secure, digital, and end-to-end verifiable e-voting for organizations. Audit-trail verified elections using SHA-256 with real-time AI security diagnostics.",
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/logo.png",
    shortcut: "/assets/logo.png",
    apple: "/assets/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HTU Elect",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontBodyClass} data-theme="light" suppressHydrationWarning>
      <body>
        <ServiceWorkerRegistrar />
        <AuthProvider>
          <LoadingScreen />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
