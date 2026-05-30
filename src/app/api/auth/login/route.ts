import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, verifyPassword } from "@/lib/users";
import { COOKIE_NAME, signToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "credentials" }, { status: 401 });
    }
    const token = await signToken({ sub: user.id, email: user.email, name: user.name });
    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: "server", detail: String(err) }, { status: 500 });
  }
}
