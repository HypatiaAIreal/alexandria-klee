import { NextRequest, NextResponse } from "next/server";
import { hasMongo } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a manually-captured crop stored in Mongo.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse("id required", { status: 400 });
  if (!hasMongo) return new NextResponse("not found", { status: 404 });
  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { ManualDiagramModel } = await import("@/lib/models");
    await connectMongo();
    const doc = await ManualDiagramModel.findById(id).lean<{ data?: string; content_type?: string }>();
    if (!doc?.data) return new NextResponse("not found", { status: 404 });
    return new NextResponse(Buffer.from(doc.data, "base64"), {
      status: 200,
      headers: {
        "Content-Type": doc.content_type || "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
