// Human-readable labels + colour tokens for metadata facets.

export const DOMAIN_LABELS: Record<string, string> = {
  form_theory: "Form theory",
  color_theory: "Colour theory",
  composition: "Composition",
  dynamics: "Dynamics",
  lineature: "Lineature",
  planimetry: "Planimetry",
  mechanics: "Mechanics",
  general: "General",
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  theory: "Theory",
  exercise: "Exercise",
  example: "Example",
  diagram: "Diagram",
  diagram_analysis: "Diagram analysis",
};

export const COMPLEXITY_LABELS: Record<string, string> = {
  introductory: "Introductory",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// Colour per Bauhaus domain — used for chips, charts and the concept map.
export const DOMAIN_COLORS: Record<string, string> = {
  form_theory: "#d8a657",
  color_theory: "#c1632f",
  composition: "#e8b964",
  dynamics: "#6f9bb3",
  lineature: "#4f8a86",
  planimetry: "#b98bb0",
  mechanics: "#a8462a",
  general: "#8a7d68",
};

export const COMPLEXITY_COLORS: Record<string, string> = {
  introductory: "#4f8a86",
  intermediate: "#d8a657",
  advanced: "#c1632f",
};

export const LANG_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
};

export function domainLabel(d: string) {
  return DOMAIN_LABELS[d] ?? d.replace(/_/g, " ");
}
export function contentTypeLabel(d: string) {
  return CONTENT_TYPE_LABELS[d] ?? d.replace(/_/g, " ");
}
export function complexityLabel(d: string) {
  return COMPLEXITY_LABELS[d] ?? d;
}
export function domainColor(d: string) {
  return DOMAIN_COLORS[d] ?? DOMAIN_COLORS.general;
}
export function tagLabel(t: string) {
  return t.replace(/_/g, " ");
}
