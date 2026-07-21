import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD_KEY = "admin_password";

async function getCurrentPassword(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: PASSWORD_KEY } });
    if (setting) return setting.value;
  } catch {
    // Si la base aún no está disponible, se usa la configuración del entorno.
  }
  return process.env.ADMIN_PASSWORD || process.env.CLARA_PASSWORD || "admin123";
}

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };
  const currentPassword = await getCurrentPassword();

  if (body.password !== currentPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
