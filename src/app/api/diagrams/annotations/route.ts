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
    const doc = await DiagramAnnotationModel.findOneAndUpdate(
      { image_url },
      {
        image_url,
        page_ref: body.page_ref ?? "",
        page_id: body.page_id ?? "",
        article_number: body.article_number ?? null,
        crop_coords: body.crop_coords ?? null,
        status: body.status ?? "",
        title: (body.title ?? "").trim(),
        description: (body.description ?? "").trim(),
        tags: Array.isArray(body.tags) ? body.tags : [],
        created_by: user.email,
        updated_at: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json({ persisted: true, annotation: JSON.parse(JSON.stringify(doc)) });
  } catch (err) {
    return NextResponse.json({ persisted: false, error: String(err) }, { status: 500 });
  }
}
