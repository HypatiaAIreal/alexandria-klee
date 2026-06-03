// ─────────────────────────────────────────────────────────────
//  MongoDB connection helper (cached across hot reloads / lambdas).
//  Connection is OPTIONAL: when MONGODB_URI is unset the app uses the
//  bundled seed dataset instead (see data.ts).
// ─────────────────────────────────────────────────────────────
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "klee_gestaltungslehre";

export const hasMongo = !!MONGODB_URI;

interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny = global as any;
const cached: Cached = globalAny._kleeMongoose || (globalAny._kleeMongoose = { conn: null, promise: null });

export async function connectMongo(): Promise<typeof mongoose> {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");
  if (cached.conn && cached.conn.connection.readyState === 1) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      bufferCommands: false,
      // Fail fast instead of hanging ~30s if Atlas is paused/unreachable.
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset so the NEXT request retries the connection (self-heals once
    // Atlas is back) instead of awaiting a permanently-rejected promise.
    cached.promise = null;
    cached.conn = null;
    throw err;
  }
  return cached.conn;
}
