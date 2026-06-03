// ─────────────────────────────────────────────────────────────
//  Mongoose models mirroring the schema in
//  klee-gestaltungslehre-project.md. Used both by the app (Atlas
//  path) and by scripts/seed-mongo.mjs.
// ─────────────────────────────────────────────────────────────
import mongoose, { Schema } from "mongoose";

const ImageSchema = new Schema(
  { url_remote: String, url_large: String, url_local: String },
  { _id: false }
);

const MetadataSchema = new Schema(
  {
    concepts_de: [String],
    concepts_en: [String],
    concepts_es: [String],
    themes: [String],
    themes_en: [String],
    themes_es: [String],
    bauhaus_domain: String,
    content_type: String,
    semantic_tags: [String],
    complexity_level: String,
    has_diagrams: Boolean,
    has_mathematical_notation: Boolean,
    teaching_context: String,
  },
  { _id: false }
);

const SearchIndexSchema = new Schema(
  {
    all_words_de: [String],
    word_count_de: Number,
    unique_words_de: Number,
    word_frequencies_de: Schema.Types.Mixed,
  },
  { _id: false }
);

const ArticleSchema = new Schema({
  id: { type: String, index: true, unique: true },
  page_ref: { type: String, index: true },
  section: String,
  part: String,
  chapter_number: Number,
  page_number: Number,
  article_number: Number,
  ref: String,
  text_de: String,
  paragraphs_de: [String],
  footnotes_de: [String],
  text_en: String,
  text_es: String,
  paragraphs_en: [String],
  paragraphs_es: [String],
  translation_status: String,
  images: [ImageSchema],
  pdf_url: String,
  metadata: MetadataSchema,
  search_index: SearchIndexSchema,
});
ArticleSchema.index({ text_de: "text", text_en: "text", text_es: "text" });

const PageSchema = new Schema({
  id: { type: String, index: true, unique: true },
  page_ref: { type: String, index: true },
  section: String,
  part: String,
  chapter_number: Number,
  chapter_name_de: String,
  page_number: Number,
  url: String,
  facsimile_local: String,
  articles: [ArticleSchema],
  total_articles: Number,
});

const ChapterSchema = new Schema({
  id: { type: String, index: true, unique: true },
  section: String,
  part: String,
  chapter_number: Number,
  name_de: String,
  name_en: String,
  name_es: String,
  url_path: String,
  total_pages: Number,
  extracted: Boolean,
});

const GlossarySchema = new Schema({
  term_de: { type: String, index: true },
  term_en: String,
  term_es: String,
  frequency: Number,
  example_contexts: [{ ref: String, context: String, _id: false }],
  category: String,
  source: String,
});

const StatsSchema = new Schema({}, { strict: false });

// Books — Klee's own writings ingested from PDF.
const BookSectionSchema = new Schema(
  { index: Number, title: String, page_start: Number, page_end: Number, text: String },
  { _id: false }
);
const BookSchema = new Schema({
  id: { type: String, index: true, unique: true },
  title: String,
  author: String,
  year: Number,
  language: String,
  source_file: String,
  total_pages: Number,
  total_sections: Number,
  total_chars: Number,
  needs_ocr: Boolean,
  cover: String,
  sections: [BookSectionSchema],
  ingested_at: String,
});
BookSchema.index({ title: "text", "sections.text": "text" });

// Admin annotations on individual diagrams (Klee's drawings/schemas).
const DiagramAnnotationSchema = new Schema({
  image_url: { type: String, index: true, unique: true },
  page_ref: String,
  page_id: { type: String, index: true },
  article_number: Number,
  crop_coords: { type: Schema.Types.Mixed, default: null },
  status: String, // "" | "correct" | "text_only"
  title: String,
  description: String,
  tags: [String],
  vector_url: String,
  ai_url: String,
  created_by: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Per-page validation state for the diagram curation workflow.
const DiagramPageStatusSchema = new Schema({
  page_id: { type: String, index: true, unique: true },
  page_ref: String,
  validated: Boolean,
  missing_images: Boolean,
  note: String,
  validated_by: String,
  updated_at: { type: Date, default: Date.now },
});

// App users (authentication). Stored in the klee_gestaltungslehre DB.
const UserSchema = new Schema({
  name: String,
  email: { type: String, index: true, unique: true },
  password_hash: String,
  created_at: { type: Date, default: Date.now },
});

// Annotations created by users in the app (the "tag system").
const AnnotationSchema = new Schema({
  article_id: { type: String, index: true },
  tags: [String],
  note: String,
  created_at: { type: Date, default: Date.now },
});

// Collection names are pinned explicitly (3rd arg) so they match the
// names written by scripts/seed-mongo.mjs — Mongoose's default
// pluralisation would otherwise read "glossaries" instead of "glossary".
export const ArticleModel =
  mongoose.models.Article || mongoose.model("Article", ArticleSchema, "articles");
export const PageModel = mongoose.models.Page || mongoose.model("Page", PageSchema, "pages");
export const ChapterModel =
  mongoose.models.Chapter || mongoose.model("Chapter", ChapterSchema, "chapters");
export const GlossaryModel =
  mongoose.models.Glossary || mongoose.model("Glossary", GlossarySchema, "glossary");
export const StatsModel = mongoose.models.Stats || mongoose.model("Stats", StatsSchema, "stats");
export const AnnotationModel =
  mongoose.models.Annotation || mongoose.model("Annotation", AnnotationSchema, "annotations");
export const UserModel = mongoose.models.User || mongoose.model("User", UserSchema, "users");
export const BookModel = mongoose.models.Book || mongoose.model("Book", BookSchema, "books");
export const DiagramAnnotationModel =
  mongoose.models.DiagramAnnotation ||
  mongoose.model("DiagramAnnotation", DiagramAnnotationSchema, "diagram_annotations");
export const DiagramPageStatusModel =
  mongoose.models.DiagramPageStatus ||
  mongoose.model("DiagramPageStatus", DiagramPageStatusSchema, "diagram_pages");
