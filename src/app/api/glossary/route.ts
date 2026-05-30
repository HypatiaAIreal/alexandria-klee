import { NextResponse } from "next/server";
import { getGlossary } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const glossary = await getGlossary();
  return NextResponse.json({ glossary });
}
