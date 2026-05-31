import { NextRequest, NextResponse } from "next/server";
import { getRelatedPassages } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const terms = (req.nextUrl.searchParams.get("terms") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 6) || 6;
  const passages = await getRelatedPassages(terms, limit);
  return NextResponse.json({ count: passages.length, passages });
}
