import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { user?: string; password?: string };
  const user = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  if (body.user === user && body.password === password) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
