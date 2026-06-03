import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { hasMongo } from "@/lib/mongodb";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { availableModels, findModel } from "@/lib/imageModels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DEFAULT_PROMPT =
  "Reproduce this drawing by Paul Klee as clean black line art on a pure white " +
  "background. Faithful to the original strokes, crisp and minimal — no shading, " +
  "no paper texture, no added text.";

const MAX_UPLOAD = 8 * 1024 * 1024; // 8 MB raw (base64 fits well under Mongo's 16 MB)

async function readImageBytes(url: string): Promise<Buffer> {
  if (url.startsWith("http")) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch crop failed: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  const local = path.join(process.cwd(), "public", url.replace(/^\/+/, ""));
  return fs.readFile(local);
}

type Generated = { b64: string; content_type: string };

// OpenAI image-edit (gpt-image-1): returns a PNG.
async function generateWithOpenAI(model: string, bytes: Buffer, prompt: string, key: string): Promise<Generated> {
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
  if (!r.ok) throw new Error(j?.error?.message ?? "openai_error");
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("no_image");
  return { b64, content_type: "image/png" };
}

// Google Gemini image models ("Nano Banana"): image-to-image editing via
// generateContent — the input crop is grounded and redrawn per the prompt.
async function generateWithGoogle(model: string, bytes: Buffer, prompt: string, key: string): Promise<Generated> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const reqBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: bytes.toString("base64") } },
        ],
      },
    ],
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(reqBody),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? "google_error");
  const parts: Array<Record<string, { data?: string; mimeType?: string; mime_type?: string }>> =
    j?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const data = imgPart?.inlineData?.data ?? imgPart?.inline_data?.data;
  if (!data) throw new Error("no_image");
  const content_type = imgPart?.inlineData?.mimeType ?? imgPart?.inline_data?.mime_type ?? "image/png";
  return { b64: data, content_type };
}

const serveUrl = (id: string) => `/api/diagrams/rendition?id=${id}`;

// ── List every rendition for one source graphic ───────────────────────────
export async function GET(req: NextRequest) {
  const image_url = req.nextUrl.searchParams.get("image_url");
  if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 });
  if (!hasMongo) return NextResponse.json({ renditions: [] });
  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { DiagramRenditionModel } = await import("@/lib/models");
    await connectMongo();
    const docs = await DiagramRenditionModel.find({ image_url })
      .select("kind prompt label model created_by created_at content_type")
      .sort({ created_at: -1 })
      .lean<
        Array<{
          _id: unknown;
          kind?: string;
          prompt?: string;
          label?: string;
          model?: string;
          created_by?: string;
          created_at?: Date;
        }>
      >();
    const renditions = docs.map((d) => ({
      id: String(d._id),
      kind: d.kind ?? "ai",
      prompt: d.prompt ?? "",
      label: d.label ?? "",
      model: d.model ?? "",
      created_by: d.created_by ?? "",
      created_at: d.created_at ?? null,
      url: serveUrl(String(d._id)),
    }));
    return NextResponse.json({ renditions });
  } catch (e) {
    return NextResponse.json({ error: "server", detail: String(e) }, { status: 500 });
  }
}

// ── Create a rendition: JSON body → AI redraw, multipart → upload ──────────
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasMongo) return NextResponse.json({ error: "no_db" }, { status: 503 });

  const ctype = req.headers.get("content-type") || "";
  let image_url = "";
  let kind: "ai" | "upload" = "ai";
  let prompt = "";
  let model = "";
  let b64 = "";
  let content_type = "image/png";

  try {
    if (ctype.includes("multipart/form-data")) {
      // ── Upload an external image ──
      kind = "upload";
      const form = await req.formData();
      image_url = String(form.get("image_url") || "");
      const file = form.get("file");
      if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 });
      if (!(file instanceof Blob)) return NextResponse.json({ error: "file required" }, { status: 400 });
      if (file.size > MAX_UPLOAD)
        return NextResponse.json({ error: "too_large", limit: MAX_UPLOAD }, { status: 413 });
      const buf = Buffer.from(await file.arrayBuffer());
      b64 = buf.toString("base64");
      content_type = (file as File).type || "image/png";
      prompt = String(form.get("label") || "");
    } else {
      // ── Generate with AI (chosen model + optional custom prompt) ──
      const body = await req.json().catch(() => ({}));
      image_url = body?.image_url;
      if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 });

      // Resolve the requested model, falling back to the first available one.
      const requested = findModel(body?.model) ?? availableModels()[0];
      if (!requested) return NextResponse.json({ error: "no_model" }, { status: 503 });
      const key = requested.provider === "google" ? process.env.GOOGLE_AI_API_KEY : process.env.OPENAI_API_KEY;
      if (!key) return NextResponse.json({ error: "no_model" }, { status: 503 });

      const custom = (body?.prompt ?? "").toString().trim();
      // A custom instruction is appended to the faithful-linework base so the
      // result stays clean line art while honouring the user's direction.
      const fullPrompt = custom ? `${DEFAULT_PROMPT}\n\nAdditional instruction: ${custom}` : DEFAULT_PROMPT;

      const bytes = await readImageBytes(image_url);
      let gen: Generated;
      try {
        gen =
          requested.provider === "google"
            ? await generateWithGoogle(requested.id, bytes, fullPrompt, key)
            : await generateWithOpenAI(requested.id, bytes, fullPrompt, key);
      } catch (e) {
        return NextResponse.json({ error: "model_error", detail: String((e as Error)?.message ?? e) }, { status: 502 });
      }
      b64 = gen.b64;
      content_type = gen.content_type;
      prompt = custom; // store only the user's words for display
      model = requested.label;
    }

    const { connectMongo } = await import("@/lib/mongodb");
    const { DiagramRenditionModel, DiagramAnnotationModel } = await import("@/lib/models");
    await connectMongo();
    const created = await DiagramRenditionModel.create({
      image_url,
      kind,
      content_type,
      data: b64,
      prompt,
      model,
      created_by: user.email,
      created_at: new Date(),
    });
    const id = String(created._id);
    const url = serveUrl(id);
    // Point the annotation's quick-view at the freshest rendition.
    await DiagramAnnotationModel.updateOne(
      { image_url },
      { $set: { image_url, ai_url: url, updated_at: new Date() }, $setOnInsert: { created_by: user.email } },
      { upsert: true }
    );
    return NextResponse.json({
      rendition: {
        id,
        kind,
        prompt,
        model,
        label: "",
        created_by: user.email,
        created_at: created.created_at,
        url,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "server", detail: String(err) }, { status: 500 });
  }
}

// ── Delete a rendition ─────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasMongo) return NextResponse.json({ error: "no_db" }, { status: 503 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const { connectMongo } = await import("@/lib/mongodb");
    const { DiagramRenditionModel, DiagramAnnotationModel } = await import("@/lib/models");
    await connectMongo();
    const doc = await DiagramRenditionModel.findById(id).select("image_url").lean<{ image_url?: string }>();
    await DiagramRenditionModel.deleteOne({ _id: id });
    // If the deleted rendition was the annotation's quick-view, repoint it to
    // the next most recent rendition (or clear it).
    if (doc?.image_url) {
      const next = await DiagramRenditionModel.findOne({ image_url: doc.image_url })
        .sort({ created_at: -1 })
        .select("_id")
        .lean<{ _id?: unknown }>();
      const ai_url = next?._id ? serveUrl(String(next._id)) : "";
      await DiagramAnnotationModel.updateOne(
        { image_url: doc.image_url },
        { $set: { ai_url, updated_at: new Date() } }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "server", detail: String(err) }, { status: 500 });
  }
}
