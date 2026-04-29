import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWAInstaller } from "@/components/PWAInstaller";
import { OfflineIndicator } from "@/components/OfflineIndicator";

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_APP_NAME || "PersonalDrive",
    template: `%s · ${process.env.NEXT_PUBLIC_APP_NAME || "PersonalDrive"}`,
  },
  description: "Self-hosted personal drive with offline support",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: process.env.NEXT_PUBLIC_APP_NAME || "PersonalDrive" },
};

export const viewport: Viewport = {
  themeColor: "#3a61ff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <PWAInstaller />
        <OfflineIndicator />
      </body>
    </html>
  );
}
