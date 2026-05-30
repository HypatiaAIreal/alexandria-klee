import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: {
    default: "Alexandria-Klee — Bildnerische Gestaltungslehre",
    template: "%s · Alexandria-Klee",
  },
  description:
    "A trilingual study interface for Paul Klee's Bauhaus teaching manuscripts — transcriptions, facsimiles, glossary and concept maps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=EB+Garamond:ital@0;1&family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-8xl px-5 pb-24 pt-6 sm:px-8">{children}</main>
        <footer className="border-t border-ink-700/60">
          <div className="mx-auto flex max-w-8xl flex-col gap-1 px-5 py-8 text-sm text-parchment-400 sm:px-8">
            <p className="font-display text-base text-parchment-200">
              Proyecto Alexandria-Klee
            </p>
            <p>
              “Hacer habitable el pensamiento visual de Paul Klee.” — A study system for the{" "}
              <em>Bildnerische Form- und Gestaltungslehre</em>.
            </p>
            <p className="text-parchment-400/70">
              Source manuscripts: Zentrum Paul Klee, Bern. This is a private, non-commercial
              study archive.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
