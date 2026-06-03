// ─────────────────────────────────────────────────────────────
//  Domain types for the Alexandria-Klee study interface.
//  These mirror the MongoDB schema described in
//  klee-gestaltungslehre-project.md.
// ─────────────────────────────────────────────────────────────

export type Lang = "de" | "en" | "es";

export interface ArticleImage {
  url_remote: string;
  url_large: string;
  /** Path relative to /public, e.g. "/manuscripts/BG/I/02/003/article1_1_large.jpg" */
  url_local: string;
}

export interface ArticleMetadata {
  concepts_de: string[];
  concepts_en: string[];
  concepts_es: string[];
  themes: string[];
  themes_en: string[];
  themes_es: string[];
  bauhaus_domain: string;
  content_type: string;
  semantic_tags: string[];
  complexity_level: "introductory" | "intermediate" | "advanced";
  has_diagrams: boolean;
  has_mathematical_notation: boolean;
  teaching_context: string;
}

export interface SearchIndex {
  all_words_de: string[];
  word_count_de: number;
  unique_words_de: number;
  word_frequencies_de: Record<string, number>;
}

export interface Article {
  /** Stable id: `${page_ref} art.${article_number}` slugified */
  id: string;
  page_ref: string;
  section: string;
  part: string;
  chapter_number: number;
  page_number: number;
  article_number: number;
  ref: string;

  text_de: string;
  paragraphs_de: string[];
  footnotes_de: string[];

  text_en: string;
  text_es: string;
  paragraphs_en: string[];
  paragraphs_es: string[];

  translation_status: string;

  images: ArticleImage[];
  pdf_url: string;

  metadata: ArticleMetadata;
  search_index: SearchIndex;
}

export interface Page {
  id: string;
  page_ref: string;
  section: string;
  part: string;
  chapter_number: number;
  chapter_name_de: string;
  page_number: number;
  url: string;
  facsimile_local: string;
  articles: Article[];
  total_articles: number;
}

export interface Chapter {
  id: string;
  section: string;
  part: string | null;
  chapter_number: number;
  name_de: string;
  name_en: string;
  name_es: string;
  url_path: string;
  total_pages: number;
  /** Whether content has actually been extracted for this chapter */
  extracted: boolean;
}

export interface GlossaryContext {
  ref: string;
  context: string;
}

export interface GlossaryEntry {
  term_de: string;
  term_en: string;
  term_es: string;
  frequency: number;
  example_contexts: GlossaryContext[];
  category: "core_concept" | "discovered" | string;
  source: string;
}

export interface CorpusStats {
  total_files: number;
  total_articles: number;
  total_words: number;
  unique_words: number;
  top_50_words: Record<string, number>;
  top_concepts: Record<string, number>;
  glossary_entries: number;
}

export interface SeedData {
  chapters: Chapter[];
  pages: Page[];
  articles: Article[];
  glossary: GlossaryEntry[];
  stats: CorpusStats;
  meta: {
    project: string;
    source: string;
    generated_at: string;
  };
}

// ── Books (Klee's own writings) ─────────────────────────────────
export interface BookSection {
  index: number;
  title: string;
  page_start: number;
  page_end: number;
  text: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number | null;
  language: string;
  source_file: string;
  total_pages: number;
  total_sections: number;
  total_chars: number;
  needs_ocr: boolean;
  cover: string;
  sections: BookSection[];
  ingested_at: string;
}

export interface BookSearchHit {
  book_id: string;
  title: string;
  author: string;
  language: string;
  section_index: number;
  section_title: string;
  snippet: string;
}

export interface RelatedPassage {
  book_id: string;
  title: string;
  language: string;
  section_index: number;
  section_title: string;
  snippet: string;
  score: number;
}

// ── Diagrams (Klee's individual drawings, isolated from pages) ──
export interface Diagram {
  image_url: string;
  facsimile: string;
  page_id: string;
  page_ref: string;
  article_number: number;
  article_ref: string;
  section: string;
  part: string | null;
  chapter_number: number;
  chapter_id: string;
  chapter_name_de: string;
  domain: string;
  vector_url?: string;
}

export type DiagramStatus = "" | "correct" | "text_only";

export interface DiagramAnnotation {
  image_url: string;
  page_ref?: string;
  page_id?: string;
  article_number?: number;
  crop_coords?: unknown;
  status?: DiagramStatus;
  title?: string;
  description?: string;
  note?: string;
  tags?: string[];
  categories?: string[];
  themes?: string[];
  vector_url?: string;
  ai_url?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DiagramPageStatus {
  page_id: string;
  page_ref?: string;
  validated?: boolean;
  missing_images?: boolean;
  note?: string;
  validated_by?: string;
  updated_at?: string;
}

/** A node in the concept co-occurrence map. */
export interface ConceptNode {
  term: string;
  term_en: string;
  frequency: number;
  domain: string;
}

export interface ConceptEdge {
  source: string;
  target: string;
  weight: number;
}

export interface ConceptGraph {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}
