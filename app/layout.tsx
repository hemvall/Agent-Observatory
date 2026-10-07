import type { Metadata } from "next";
import "./globals.css";
import "./observatory.css";
import "./work-lab.css";

export const metadata: Metadata = {
  title: "Agent Observatory",
  description:
    "Construisez un assistant documentaire, observez ses agents animés et comparez vos versions sur des tests reproductibles.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
