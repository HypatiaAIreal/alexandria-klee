import { NextRequest, NextResponse } from "next/server";
import { hasMongo } from "@/lib/mongodb";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 8 * 1024 * 1024; // 8 MB

// Store a manually-captured crop (pasted from the clipboard or uploaded) as a
// new graphic for a page. It then merges into the diagram gallery.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasMongo) return NextResponse.json({ error: "no_db" }, { status: 503 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "too_large", limit: MAX }, { status: 413 });

  const str = (k: string) => String(form.get(k) ?? "");
  const num = (k: string) => {
    const v = form.get(k);
    return v == null || v === "" ? null : Number(v);
  };
  const page_id = str("page_id");
  if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { connectMongo } = await import("@/lib/mongodb");
    const { ManualDiagramModel } = await import("@/lib/models");
    await connectMongo();
    const doc = await ManualDiagramModel.create({
      page_id,
      page_ref: str("page_ref"),
      chapter_id: str("chapter_id"),
      section: str("section"),
      part: str("part") || null,
      chapter_number: num("chapter_number"),
      chapter_name_de: str("chapter_name_de"),
      article_number: num("article_number"),
      facsimile: str("facsimile"),
      content_type: (file as File).type || "image/png",
      data: buf.toString("base64"),
      label: str("label"),
      created_by: user.email,
      created_at: new Date(),
    });
    const id = String(doc._id);
    return NextResponse.json({
      diagram: {
        id,
        image_url: `/api/diagrams/capture-image?id=${id}`,
        page_id,
        page_ref: str("page_ref"),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "server", detail: String(err) }, { status: 500 });
  }
}
