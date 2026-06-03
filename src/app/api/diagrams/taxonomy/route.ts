import { NextResponse } from "next/server";
import { hasMongo } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the distinct categories & themes used across diagram annotations,
// so the UI can offer them as a memorized, growing dropdown.
export async function GET() {
  if (!hasMongo) return NextResponse.json({ categories: [], themes: [] });
  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { DiagramAnnotationModel } = await import("@/lib/models");
    await connectMongo();
    const [categories, themes] = await Promise.all([
      DiagramAnnotationModel.distinct("categories"),
      DiagramAnnotationModel.distinct("themes"),
    ]);
    const clean = (a: unknown[]) =>
      Array.from(new Set(a.filter((x): x is string => typeof x === "string" && x.trim() !== ""))).sort((x, y) =>
        x.localeCompare(y)
      );
    return NextResponse.json({ categories: clean(categories), themes: clean(themes) });
  } catch (e) {
    return NextResponse.json({ categories: [], themes: [], error: String(e) });
  }
}
