import { NextRequest, NextResponse } from "next/server";
import { hasMongo } from "@/lib/mongodb";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-page validation state for the diagram curation workflow.
export async function GET(req: NextRequest) {
  if (!hasMongo) return NextResponse.json({ persisted: false, pages: [] });
  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { DiagramPageStatusModel } = await import("@/lib/models");
    await connectMongo();
    const pageId = req.nextUrl.searchParams.get("page_id");
    const docs = await DiagramPageStatusModel.find(pageId ? { page_id: pageId } : {}).lean();
    return NextResponse.json({ persisted: true, pages: JSON.parse(JSON.stringify(docs)) });
  } catch (err) {
    return NextResponse.json({ persisted: false, pages: [], error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const page_id = body?.page_id;
  if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 });
  if (!hasMongo) return NextResponse.json({ persisted: false, error: "no_db" }, { status: 503 });

  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { DiagramPageStatusModel } = await import("@/lib/models");
    await connectMongo();
    const doc = await DiagramPageStatusModel.findOneAndUpdate(
      { page_id },
      {
        page_id,
        page_ref: body.page_ref ?? "",
        validated: !!body.validated,
        missing_images: !!body.missing_images,
        note: (body.note ?? "").trim(),
        validated_by: user.email,
        updated_at: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json({ persisted: true, page: JSON.parse(JSON.stringify(doc)) });
  } catch (err) {
    return NextResponse.json({ persisted: false, error: String(err) }, { status: 500 });
  }
}
