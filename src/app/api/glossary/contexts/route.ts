import { NextRequest, NextResponse } from "next/server";
import { getGlossaryContexts } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Example contexts for a single glossary term (loaded when a term is expanded).
export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("term") ?? "";
  const contexts = await getGlossaryContexts(term);
  return NextResponse.json({ contexts });
}
