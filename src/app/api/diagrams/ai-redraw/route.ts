import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { hasMongo } from "@/lib/mongodb";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DEFAULT_PROMPT =
  "Reproduce this drawing by Paul Klee as clean black line art on a pure white " +
  "background. Faithful to the original strokes, crisp and minimal — no shading, " +
  "no paper texture, no added text.";

async function readImageBytes(url: string): Promise<Buffer> {
  if (url.startsWith("http")) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch crop failed: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  const local = path.join(process.cwd(), "public", url.replace(/^\/+/, ""));
  return fs.readFile(local);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "no_model" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const image_url: string = body?.image_url;
  if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 });

  const model = process.env.IMAGE_MODEL || "gpt-image-1";
  const prompt = process.env.AI_REDRAW_PROMPT || DEFAULT_PROMPT;

  try {
    const bytes = await readImageBytes(image_url);

    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", process.env.IMAGE_SIZE || "auto");
    form.append("image", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "klee.jpg");

    const r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const j = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: "model_error", detail: j?.error?.message ?? j }, { status: 502 });
    }
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "no_image" }, { status: 502 });

    // Persist the image IN MongoDB (read-only FS on serverless) and serve it
    // via /api/diagrams/ai-image. ai_url points at that route.
    if (!hasMongo) return NextResponse.json({ error: "no_db" }, { status: 503 });
    const ai_url = `/api/diagrams/ai-image?u=${encodeURIComponent(image_url)}`;
    try {
      const { connectMongo } = await import("@/lib/mongodb");
      const { DiagramAiImageModel, DiagramAnnotationModel } = await import("@/lib/models");
      await connectMongo();
      await DiagramAiImageModel.updateOne(
        { image_url },
        { $set: { image_url, content_type: "image/png", data: b64, created_by: user.email, created_at: new Date() } },
        { upsert: true }
      );
      await DiagramAnnotationModel.updateOne(
        { image_url },
        { $set: { image_url, ai_url, updated_at: new Date() }, $setOnInsert: { created_by: user.email } },
        { upsert: true }
      );
    } catch (e) {
      return NextResponse.json({ error: "store_failed", detail: String(e) }, { status: 500 });
    }

    return NextResponse.json({ ai_url });
  } catch (err) {
    return NextResponse.json({ error: "server", detail: String(err) }, { status: 500 });
  }
}
