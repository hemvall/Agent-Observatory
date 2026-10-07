import type { Metadata } from "next";
import "./globals.css";
import "./observatory.css";

export const metadata: Metadata = {
  title: "Agent Observatory",
  description:
    "Analysez un document ou un dépôt GitHub avec une équipe de personnages animés. Comprenez les points à améliorer et obtenez un rapport avec ses sources.",
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
