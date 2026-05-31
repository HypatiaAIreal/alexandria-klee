// ─────────────────────────────────────────────────────────────
//  seed-mongo.mjs
//  Loads src/data/seed.json into MongoDB Atlas and creates the
//  indexes described in klee-gestaltungslehre-project.md.
//
//  Usage:
//    1. Set MONGODB_URI (and optionally MONGODB_DB) in .env
//    2. npm run seed:mongo
// ─────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.join(__dirname, "..");

// Minimal .env loader (no dependency).
function loadEnv() {
  const envPath = path.join(PROJECT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const URI = process.env.MONGODB_URI;
const DB = process.env.MONGODB_DB || "klee_gestaltungslehre";

if (!URI) {
  console.error("✗ MONGODB_URI is not set. Add it to .env or the environment.");
  process.exit(1);
}

const seed = JSON.parse(fs.readFileSync(path.join(PROJECT, "src", "data", "seed.json"), "utf-8"));

// slug — kept in sync with src/lib/util.ts / build-seed.mjs
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[.\s/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

// Guarantee every article has a unique, non-null `id`. Pipeline-extracted
// articles can be missing it, which collides on the unique articles.id index
// (duplicate null key). Generate one from page_ref + article_number and
// de-duplicate defensively.
function ensureIds(articles, label) {
  if (!Array.isArray(articles)) return;
  const seen = new Set();
  let fixed = 0;
  articles.forEach((a, i) => {
    let id = a.id ? String(a.id).trim() : "";
    if (!id) {
      const base = a.page_ref ? slug(a.page_ref) : "article";
      const num = a.article_number ?? i;
      id = `${base}-a${num}`;
      fixed++;
    }
    let unique = id;
    let n = 1;
    while (seen.has(unique)) unique = `${id}-${n++}`;
    seen.add(unique);
    a.id = unique;
  });
  if (fixed) console.log(`  [ids] generated ${fixed} missing id(s) in ${label}`);
}

ensureIds(seed.articles, "articles");
for (const p of seed.pages ?? []) ensureIds(p.articles, `page ${p.page_ref ?? p.id}`);

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log(`Connected → ${DB}`);
  const db = client.db(DB);

  // Drop each collection first (clears stale docs AND old indexes) so a
  // re-seed can't trip over leftover unique-index entries.
  const load = async (name, docs) => {
    const col = db.collection(name);
    await col.drop().catch(() => {}); // ignore "ns not found"
    if (docs.length) await col.insertMany(docs);
    console.log(`  ${name}: ${docs.length}`);
  };

  await load("chapters", seed.chapters);
  await load("pages", seed.pages);
  await load("articles", seed.articles);
  await load("glossary", seed.glossary);
  await db.collection("stats").deleteMany({});
  await db.collection("stats").insertOne(seed.stats);
  console.log(`  stats: 1`);

  // Books (Klee's own writings) — optional, from src/data/books.json
  const booksPath = path.join(PROJECT, "src", "data", "books.json");
  if (fs.existsSync(booksPath)) {
    const books = JSON.parse(fs.readFileSync(booksPath, "utf-8")).books ?? [];
    await load("books", books);
    if (books.length) {
      await db.collection("books").createIndex({ id: 1 }, { unique: true });
      await db.collection("books").createIndex({ title: "text", "sections.text": "text" });
    }
  }

  // Indexes (from the project schema doc)
  await db.collection("articles").createIndex({ text_de: "text", text_en: "text", text_es: "text" });
  await db.collection("articles").createIndex({ section: 1, part: 1, chapter_number: 1, page_number: 1 });
  await db.collection("articles").createIndex({ "metadata.concepts_de": 1 });
  await db.collection("articles").createIndex({ id: 1 }, { unique: true });
  await db.collection("pages").createIndex({ id: 1 }, { unique: true });
  await db.collection("chapters").createIndex({ id: 1 }, { unique: true });
  await db.collection("glossary").createIndex({ frequency: -1 });
  await db.collection("glossary").createIndex({ term_de: 1 }, { unique: true });
  console.log("Indexes created.");

  await client.close();
  console.log("✓ Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
