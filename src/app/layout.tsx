import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { LanguageProvider } from "@/components/LanguageProvider";
import { AuthProvider, type SessionUser } from "@/components/AuthProvider";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

export const metadata: Metadata = {
  title: {
    default: "Alexandria-Klee — Bildnerische Gestaltungslehre",
    template: "%s · Alexandria-Klee",
  },
  description:
    "A trilingual study interface for Paul Klee's Bauhaus teaching manuscripts — transcriptions, facsimiles, glossary and concept maps.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve the session once on the server so the header never flickers.
  const token = cookies().get(COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;
  const initialUser: SessionUser | null = payload
    ? { id: payload.sub, name: payload.name, email: payload.email }
    : null;

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
        <LanguageProvider>
          <AuthProvider initialUser={initialUser}>
            <SiteHeader />
            <main className="mx-auto w-full max-w-8xl px-5 pb-24 pt-6 sm:px-8">{children}</main>
            <SiteFooter />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
