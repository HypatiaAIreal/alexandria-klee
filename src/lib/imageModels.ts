// ─────────────────────────────────────────────────────────────
//  Image-generation model registry.
//
//  The diagram "Generate (AI)" action can route to more than one
//  provider. Which models are *offered* depends on which API keys are
//  configured in the environment (server side), so users only ever see
//  models that will actually work.
// ─────────────────────────────────────────────────────────────

export type ImageProvider = "google" | "openai";

export interface ImageModel {
  id: string;
  label: string;
  provider: ImageProvider;
  note?: string;
}

// Order = preference. The first *available* one is the default.
// Google "Nano Banana" image models (Gemini) reproduce hand-drawn line
// art beautifully; OpenAI gpt-image-1 stays as an alternative.
export const IMAGE_MODELS: ImageModel[] = [
  { id: "gemini-3-pro-image", label: "Nano Banana Pro", provider: "google", note: "Gemini 3 Pro Image" },
  { id: "gemini-3.1-flash-image", label: "Nano Banana 2", provider: "google", note: "Gemini 3.1 Flash Image" },
  { id: "gemini-2.5-flash-image", label: "Nano Banana", provider: "google", note: "Gemini 2.5 Flash Image" },
  { id: "gpt-image-1", label: "GPT Image", provider: "openai", note: "OpenAI gpt-image-1" },
];

export function providerAvailable(p: ImageProvider): boolean {
  return p === "google" ? !!process.env.GOOGLE_AI_API_KEY : !!process.env.OPENAI_API_KEY;
}

/** Models the current environment can actually run (have a key for). */
export function availableModels(): ImageModel[] {
  return IMAGE_MODELS.filter((m) => providerAvailable(m.provider));
}

export function findModel(id?: string | null): ImageModel | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}
