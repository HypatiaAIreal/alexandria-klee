// ─────────────────────────────────────────────────────────────
//  User store (Node runtime only — used by /api/auth/* routes).
//  Backed by MongoDB Atlas (collection `users` in klee_gestaltungslehre)
//  when MONGODB_URI is set; otherwise a local JSON file so the app can
//  run with zero config in development.
// ─────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { hasMongo } from "./mongodb";

export const ACCESS_CODE = process.env.ACCESS_CODE || "alexandriaklee2026";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

const FILE = path.join(process.cwd(), ".data", "users.json");

function readFileStore(): StoredUser[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return [];
  }
}
function writeFileStore(users: StoredUser[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2), "utf-8");
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const norm = email.trim().toLowerCase();
  if (hasMongo) {
    const { connectMongo } = await import("./mongodb");
    const { UserModel } = await import("./models");
    await connectMongo();
    const u = await UserModel.findOne({ email: norm }).lean<{
      _id: unknown;
      name: string;
      email: string;
      password_hash: string;
    }>();
    if (!u) return null;
    return { id: String(u._id), name: u.name, email: u.email, password_hash: u.password_hash };
  }
  return readFileStore().find((u) => u.email === norm) ?? null;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const password_hash = await bcrypt.hash(input.password, 10);
  if (hasMongo) {
    const { connectMongo } = await import("./mongodb");
    const { UserModel } = await import("./models");
    await connectMongo();
    const doc = await UserModel.create({ name: input.name, email, password_hash });
    return { id: String(doc._id), name: doc.name, email: doc.email };
  }
  const users = readFileStore();
  const id = `local_${Date.now().toString(36)}`;
  users.push({ id, name: input.name, email, password_hash });
  writeFileStore(users);
  return { id, name: input.name, email };
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
