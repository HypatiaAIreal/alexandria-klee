"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";

const ERROR_KEY: Record<string, string> = {
  credentials: "auth.errorCredentials",
  access_code: "auth.errorAccessCode",
  exists: "auth.errorExists",
  server: "auth.errorGeneric",
  missing_fields: "auth.errorGeneric",
  weak_password: "auth.errorGeneric",
};

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const router = useRouter();
  const search = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister ? { name, email, password, accessCode } : { email, password };
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(t(ERROR_KEY[d.error] ?? "auth.errorGeneric"));
        setBusy(false);
        return;
      }
      await refresh();
      const from = search.get("from");
      router.push(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError(t("auth.errorGeneric"));
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-parchment-100 outline-none placeholder:text-parchment-400/50 focus:border-ochre/50";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-10">
      <div className="panel animate-fade-up p-7">
        <p className="label mb-2">{t("footer.title")}</p>
        <h1 className="font-display text-3xl text-parchment-50">
          {t(isRegister ? "auth.registerTitle" : "auth.loginTitle")}
        </h1>
        <p className="mt-2 text-sm text-parchment-300">
          {t(isRegister ? "auth.registerSubtitle" : "auth.loginSubtitle")}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {isRegister && (
            <label className="block">
              <span className="label mb-1 block">{t("auth.name")}</span>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label className="block">
            <span className="label mb-1 block">{t("auth.email")}</span>
            <input
              className={field}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="label mb-1 block">{t("auth.password")}</span>
            <input
              className={field}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </label>
          {isRegister && (
            <label className="block">
              <span className="label mb-1 block">{t("auth.accessCode")}</span>
              <input
                className={field}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
              />
              <span className="mt-1 block text-xs text-parchment-400/70">{t("auth.accessCodeHint")}</span>
            </label>
          )}

          {error && (
            <p className="rounded-md border border-rust/40 bg-rust/10 px-3 py-2 text-sm text-rust">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-ochre px-5 py-2.5 font-medium text-ink-950 transition-colors hover:bg-amber disabled:opacity-60"
          >
            {busy ? t("auth.working") : t(isRegister ? "auth.createAccount" : "auth.signIn")}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-parchment-400">
          {t(isRegister ? "auth.haveAccount" : "auth.noAccount")}{" "}
          <Link href={isRegister ? "/login" : "/register"} className="text-ochre hover:text-amber">
            {t(isRegister ? "auth.loginLink" : "auth.registerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
