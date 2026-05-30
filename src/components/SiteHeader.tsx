"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";
import LanguageSelector from "@/components/LanguageSelector";

const NAV = [
  { href: "/", key: "nav.overview", exact: true },
  { href: "/browse", key: "nav.browse" },
  { href: "/search", key: "nav.search" },
  { href: "/glossary", key: "nav.glossary" },
  { href: "/concepts", key: "nav.concepts" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const onAuthPage = pathname === "/login" || pathname === "/register";

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-8xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href={user ? "/" : "/login"} className="group flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-ochre/40 bg-ink-800 font-display text-lg text-ochre transition-colors group-hover:border-ochre/80">
            K
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[1.05rem] tracking-wide text-parchment-50">
              Alexandria<span className="text-ochre">·</span>Klee
            </span>
            <span className="label mt-1 hidden sm:block">Bildnerische Gestaltungslehre</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {user && !onAuthPage && (
            <nav className="flex items-center gap-1 overflow-x-auto sm:gap-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive(item)
                      ? "bg-ochre/15 text-ochre"
                      : "text-parchment-300 hover:bg-ink-800 hover:text-parchment-50"
                  }`}
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
          )}

          <LanguageSelector />

          {user && !onAuthPage && (
            <div className="flex items-center gap-2 border-l border-ink-700 pl-2 sm:pl-3">
              <span className="hidden font-mono text-xs text-parchment-400 lg:block" title={user.email}>
                {user.name}
              </span>
              <button
                onClick={logout}
                className="rounded-md border border-ink-700 px-2.5 py-1.5 text-sm text-parchment-300 transition-colors hover:border-rust/50 hover:text-rust"
              >
                {t("account.logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
