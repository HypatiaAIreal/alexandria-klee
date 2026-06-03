import { NextResponse } from "next/server";
import { availableModels } from "@/lib/imageModels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lists the image-generation models the server can run (those with a key).
export async function GET() {
  const models = availableModels().map((m) => ({ id: m.id, label: m.label, provider: m.provider, note: m.note }));
  return NextResponse.json({ models });
}
