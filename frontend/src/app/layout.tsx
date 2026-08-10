import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/AuthContext";

// Import all theme styling sheets
import "@/styles/variables.css";
import "@/styles/base.css";
import "@/styles/components.css";
import "@/styles/layout.css";
import "@/styles/animations.css";
import "@/styles/pages/landing.css";
import "@/styles/pages/auth.css";
import "@/styles/pages/voter.css";
import "@/styles/pages/admin.css";

const fontBodyClass = "font-sans";

import LoadingScreen from "./LoadingScreen";
import ServiceWorkerRegistrar from "./ServiceWorkerRegistrar";

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "HTU Elect ✓ - Secure Digital Elections & Cryptographic Verification",
  description: "Secure, digital, and end-to-end verifiable e-voting for organizations. Audit-trail verified elections using SHA-256 with real-time AI security diagnostics.",
  manifest: "/manifest.json",
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
