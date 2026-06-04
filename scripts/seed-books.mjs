// Seed ONLY the `books` collection from src/data/books.json — used after a
// book re-ingest, so we don't have to re-seed the whole corpus.
//   node scripts/seed-books.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.join(__dirname, "..");

// Minimal .env loader (no dependency).
const envPath = path.join(PROJECT, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const URI = process.env.MONGODB_URI;
const DB = process.env.MONGODB_DB || "klee_gestaltungslehre";
if (!URI) {
  console.error("✗ MONGODB_URI is not set. Add it to .env.");
  process.exit(1);
}

const booksPath = path.join(PROJECT, "src", "data", "books.json");
const books = JSON.parse(fs.readFileSync(booksPath, "utf-8")).books ?? [];

const client = new MongoClient(URI);
await client.connect();
const db = client.db(DB);
const col = db.collection("books");
await col.deleteMany({});
if (books.length) {
  await col.insertMany(books);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ title: "text", "sections.text": "text" });
}
console.log(`✓ Seeded ${books.length} books → ${DB}.books`);
for (const b of books) console.log(`   - ${b.title}  (${b.total_sections} sec, ${b.total_chars.toLocaleString()} chars)`);
await client.close();
