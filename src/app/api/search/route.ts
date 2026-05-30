import { NextRequest, NextResponse } from "next/server";
import { searchArticles, type SearchParams } from "@/lib/data";
import type { Lang } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params: SearchParams = {
    q: sp.get("q") ?? "",
    lang: (sp.get("lang") as Lang | "all") ?? "all",
    domain: sp.get("domain") ?? undefined,
    complexity: sp.get("complexity") ?? undefined,
    contentType: sp.get("contentType") ?? undefined,
    tag: sp.get("tag") ?? undefined,
  };
  const hits = await searchArticles(params);
  return NextResponse.json({ count: hits.length, hits });
}
