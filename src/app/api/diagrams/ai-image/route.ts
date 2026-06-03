import { NextRequest, NextResponse } from "next/server";
import { hasMongo } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves an AI-redrawn diagram image stored in MongoDB.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "u required" }, { status: 400 });
  if (!hasMongo) return new NextResponse("not found", { status: 404 });
  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { DiagramAiImageModel } = await import("@/lib/models");
    await connectMongo();
    const doc = await DiagramAiImageModel.findOne({ image_url: u }).lean<{
      data?: string;
      content_type?: string;
    }>();
    if (!doc?.data) return new NextResponse("not found", { status: 404 });
    const buf = Buffer.from(doc.data, "base64");
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": doc.content_type || "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return new NextResponse(`error: ${err}`, { status: 500 });
  }
}
