import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
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

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Votick ✓ - Secure Digital Elections & Cryptographic Verification",
  description: "Secure, digital, and end-to-end verifiable e-voting for organizations. Audit-trail verified elections using SHA-256 with real-time AI security diagnostics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`} data-theme="light">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
