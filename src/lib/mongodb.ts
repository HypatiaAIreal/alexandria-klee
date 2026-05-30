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
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      bufferCommands: false,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
