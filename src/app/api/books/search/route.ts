import { NextRequest, NextResponse } from "next/server";
import { searchBooks } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const lang = sp.get("lang") ?? undefined;
  const hits = await searchBooks(q, lang || undefined);
  return NextResponse.json({ count: hits.length, hits });
}
