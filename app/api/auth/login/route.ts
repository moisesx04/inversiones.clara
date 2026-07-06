import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD_KEY = "admin_password";

async function getCurrentPassword(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: PASSWORD_KEY } });
    if (setting) return setting.value;
  } catch {
    // DB not ready, use env fallback
  }
  return process.env.ADMIN_PASSWORD || process.env.CLARA_PASSWORD || "admin123";
}

export async function POST(request: Request) {
  const body = (await request.json()) as { user?: string; password?: string };
  const user = process.env.ADMIN_USER || process.env.CLARA_USER || "admin";
  const password = await getCurrentPassword();

  if (body.user === user && body.password === password) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
