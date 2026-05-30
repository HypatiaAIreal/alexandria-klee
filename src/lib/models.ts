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

// Annotations created by users in the app (the "tag system").
const AnnotationSchema = new Schema({
  article_id: { type: String, index: true },
  tags: [String],
  note: String,
  created_at: { type: Date, default: Date.now },
});

export const ArticleModel =
  mongoose.models.Article || mongoose.model("Article", ArticleSchema);
export const PageModel = mongoose.models.Page || mongoose.model("Page", PageSchema);
export const ChapterModel =
  mongoose.models.Chapter || mongoose.model("Chapter", ChapterSchema);
export const GlossaryModel =
  mongoose.models.Glossary || mongoose.model("Glossary", GlossarySchema);
export const StatsModel = mongoose.models.Stats || mongoose.model("Stats", StatsSchema);
export const AnnotationModel =
  mongoose.models.Annotation || mongoose.model("Annotation", AnnotationSchema);
