import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AuthProvider } from "@/context/AuthContext";

// Import unified Tailwind CSS stylesheet
import "./globals.css";

const fontBodyClass = "font-sans";

// Older iOS Safari (and every iPhone browser, which is WebKit underneath) lacks
// a few modern JS APIs that Next 16's runtime calls at startup — most
// critically Promise.withResolvers (Safari 17.4+). On an iPhone 6s (iOS <= 15.8)
// that call throws and kills the ENTIRE React app before hydration: no login
// handlers, no success popup, no error messages. These micro-polyfills run
// before any Next.js code so the app boots on old iPhones.
const iosCompatShims = `
(function () {
  try {
    if (typeof Promise !== 'undefined' && !Promise.withResolvers) {
      Promise.withResolvers = function () {
        var out = {};
        out.promise = new Promise(function (resolve, reject) {
          out.resolve = resolve;
          out.reject = reject;
        });
        return out;
      };
    }
  } catch (e) {}
  try {
    if (!Array.prototype.at) {
      Array.prototype.at = function (index) {
        var n = Number(index) || 0;
        n = n < 0 ? Math.max(this.length + n, 0) : n;
        return n < this.length ? this[n] : undefined;
      };
    }
  } catch (e) {}
  try {
    if (!String.prototype.replaceAll) {
      String.prototype.replaceAll = function (search, replacement) {
        if (search instanceof RegExp) {
          return this.replace(search, String(replacement));
        }
        return this.split(String(search)).join(String(replacement));
      };
    }
  } catch (e) {}
  try {
    if (!Object.hasOwn) {
      Object.hasOwn = function (obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
      };
    }
  } catch (e) {}
})();
`;

import LoadingScreen from "./LoadingScreen";
import ServiceWorkerRegistrar from "./ServiceWorkerRegistrar";


export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "HTU Elect - Secure Digital Elections",
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
      {/* Runs before any Next.js module so old iOS WebKit gets the APIs the
          runtime expects. */}
      <Script
        id="ios-compat-shims"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: iosCompatShims }}
      />
      <body>
        <ServiceWorkerRegistrar />
        <AuthProvider>
          {/* <LoadingScreen /> */}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
