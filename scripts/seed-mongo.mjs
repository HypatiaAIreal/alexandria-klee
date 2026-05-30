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

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log(`Connected → ${DB}`);
  const db = client.db(DB);

  const load = async (name, docs) => {
    const col = db.collection(name);
    await col.deleteMany({});
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
