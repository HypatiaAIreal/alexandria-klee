import { NextRequest, NextResponse } from "next/server";
import { ACCESS_CODE, createUser, findUserByEmail } from "@/lib/users";
import { COOKIE_NAME, signToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").trim();
  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  const accessCode = body?.accessCode ?? "";

  if (!name || !email || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (accessCode !== ACCESS_CODE) {
    return NextResponse.json({ error: "access_code" }, { status: 403 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) return NextResponse.json({ error: "exists" }, { status: 409 });

    const user = await createUser({ name, email, password });
    const token = await signToken({ sub: user.id, email: user.email, name: user.name });

    const res = NextResponse.json({ user });
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
