import { NextRequest, NextResponse } from "next/server";
import { getDiagrams } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chapter = sp.get("chapter") || undefined;
  const page = sp.get("page") || undefined;
  const typeParam = sp.get("type");
  const type = typeParam === "text" || typeParam === "all" ? typeParam : "graphics";
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 60) || 60));
  const { total, diagrams } = await getDiagrams({ chapter, page, type, offset, limit });
  return NextResponse.json({ total, offset, limit, diagrams });
}
