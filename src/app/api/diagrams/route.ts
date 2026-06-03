import { NextRequest, NextResponse } from "next/server";
import { getDiagrams } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chapter = sp.get("chapter") || undefined;
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(120, Math.max(1, Number(sp.get("limit") ?? 60) || 60));
  const { total, diagrams } = await getDiagrams({ chapter, offset, limit });
  return NextResponse.json({ total, offset, limit, diagrams });
}
