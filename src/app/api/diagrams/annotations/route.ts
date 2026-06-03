import { NextRequest, NextResponse } from "next/server";
import { hasMongo } from "@/lib/mongodb";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagram annotations live in the `diagram_annotations` collection. They
// require MongoDB (and authentication to write).

export async function GET(req: NextRequest) {
  if (!hasMongo) return NextResponse.json({ persisted: false, annotations: [] });
  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { DiagramAnnotationModel } = await import("@/lib/models");
    await connectMongo();
    const chapter = req.nextUrl.searchParams.get("chapter");
    const filter = chapter ? { page_ref: new RegExp(chapter, "i") } : {};
    // Return all (corpus annotation count stays small); client maps by image_url.
    const annotations = await DiagramAnnotationModel.find(filter).lean();
    return NextResponse.json({ persisted: true, annotations });
  } catch (err) {
    return NextResponse.json({ persisted: false, annotations: [], error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  // auth required to write
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const image_url = body?.image_url;
  if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 });
  if (!hasMongo) return NextResponse.json({ persisted: false, error: "no_db" }, { status: 503 });

  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { DiagramAnnotationModel } = await import("@/lib/models");
    await connectMongo();

    // Partial update: only touch the fields actually present in the body, so
    // saving (say) a status never wipes notes/categories saved elsewhere.
    const set: Record<string, unknown> = { image_url, updated_at: new Date() };
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    if (has("page_ref")) set.page_ref = body.page_ref ?? "";
    if (has("page_id")) set.page_id = body.page_id ?? "";
    if (has("article_number")) set.article_number = body.article_number ?? null;
    if (has("crop_coords")) set.crop_coords = body.crop_coords ?? null;
    if (has("status")) set.status = body.status ?? "";
    if (has("title")) set.title = (body.title ?? "").trim();
    if (has("description")) set.description = (body.description ?? "").trim();
    if (has("note")) set.note = (body.note ?? "").trim();
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim() !== "") : []);
    if (has("tags")) set.tags = arr(body.tags);
    if (has("categories")) set.categories = arr(body.categories);
    if (has("themes")) set.themes = arr(body.themes);

    const doc = await DiagramAnnotationModel.findOneAndUpdate(
      { image_url },
      { $set: set, $setOnInsert: { created_by: user.email } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json({ persisted: true, annotation: JSON.parse(JSON.stringify(doc)) });
  } catch (err) {
    return NextResponse.json({ persisted: false, error: String(err) }, { status: 500 });
  }
}
