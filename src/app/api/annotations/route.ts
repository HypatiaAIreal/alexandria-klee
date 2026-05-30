import { NextRequest, NextResponse } from "next/server";
import { hasMongo } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// The tag system persists to MongoDB Atlas when configured. Without a
// connection the client keeps annotations in localStorage, so these
// endpoints degrade gracefully (they report `persisted: false`).

export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get("articleId") ?? undefined;
  if (!hasMongo) return NextResponse.json({ persisted: false, annotations: [] });
  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { AnnotationModel } = await import("@/lib/models");
    await connectMongo();
    const annotations = await AnnotationModel.find(
      articleId ? { article_id: articleId } : {}
    ).lean();
    return NextResponse.json({ persisted: true, annotations });
  } catch (err) {
    return NextResponse.json({ persisted: false, annotations: [], error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { article_id, tags = [], note = "" } = body ?? {};
  if (!article_id) return NextResponse.json({ error: "article_id required" }, { status: 400 });
  if (!hasMongo) return NextResponse.json({ persisted: false });
  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { AnnotationModel } = await import("@/lib/models");
    await connectMongo();
    const doc = await AnnotationModel.findOneAndUpdate(
      { article_id },
      { article_id, tags, note },
      { upsert: true, new: true }
    ).lean();
    return NextResponse.json({ persisted: true, annotation: doc });
  } catch (err) {
    return NextResponse.json({ persisted: false, error: String(err) }, { status: 500 });
  }
}
