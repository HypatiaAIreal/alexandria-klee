import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ user: null });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: payload.sub, name: payload.name, email: payload.email },
  });
}
